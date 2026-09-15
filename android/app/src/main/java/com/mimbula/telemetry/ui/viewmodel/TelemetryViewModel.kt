package com.mimbula.telemetry.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mimbula.telemetry.data.*
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*
import javax.inject.Inject

@HiltViewModel
class TelemetryViewModel @Inject constructor(
    private val repository: TelemetryRepository
) : ViewModel() {

    // UI States
    val pads: StateFlow<List<LeachPadEntity>> = repository.leachPads
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val ponds: StateFlow<List<PondTelemetryEntity>> = repository.ponds
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val submissions: StateFlow<List<ShiftSubmissionEntity>> = repository.submissions
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    // FOHL flow mapping (LP1 feeds FOHL, FOHL feeds LP1, LP2, LP3)
    val fohlFlows: StateFlow<Map<String, Double>> = pads
        .map { padList ->
            val lp1 = padList.find { it.id == "LP1" } ?: LeachPadEntity("LP1", 0.0, 0.0, "Off", "RAF", 100, 0)
            repository.calculateFohlFlow(lp1)
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyMap())

    // Selected Shift ID state
    private val _currentShiftId = MutableStateFlow("SHIFT-${SimpleDateFormat("yyyyMMdd", Locale.getDefault()).format(Date())}-A")
    val currentShiftId: StateFlow<String> = _currentShiftId.asStateFlow()

    // Operator Details
    private val _operatorEmail = MutableStateFlow("kaungu89@gmail.com")
    val operatorEmail: StateFlow<String> = _operatorEmail.asStateFlow()

    private val _operatorName = MutableStateFlow("Miguel Kaungu")
    val operatorName: StateFlow<String> = _operatorName.asStateFlow()

    private val _employmentNumber = MutableStateFlow("MML-PROC-8942")
    val employmentNumber: StateFlow<String> = _employmentNumber.asStateFlow()

    // Acid and process state levels (Simulation)
    private val _acidTank1Level = MutableStateFlow(10.9) // Starts low to show alert
    val acidTank1Level: StateFlow<Double> = _acidTank1Level.asStateFlow()

    private val _acidTank2Level = MutableStateFlow(81.4)
    val acidTank2Level: StateFlow<Double> = _acidTank2Level.asStateFlow()

    private val _plsPondLevel = MutableStateFlow(65.5)
    val plsPondLevel: StateFlow<Double> = _plsPondLevel.asStateFlow()

    // AI Report Response State
    private val _aiReport = MutableStateFlow("")
    val aiReport: StateFlow<String> = _aiReport.asStateFlow()

    private val _isGeneratingReport = MutableStateFlow(false)
    val isGeneratingReport: StateFlow<Boolean> = _isGeneratingReport.asStateFlow()

    init {
        viewModelScope.launch {
            repository.seedDatabaseIfEmpty()
        }
    }

    fun updatePadFlow(id: String, minFlow: Double, maxFlow: Double, status: String) {
        viewModelScope.launch {
            val padList = pads.value
            val target = padList.find { it.id == id }
            if (target != null) {
                repository.updateLeachPad(target.copy(minFlow = minFlow, maxFlow = maxFlow, status = status))
            }
        }
    }

    fun updatePondFlow(id: String, flow: Double, totalizer: Double) {
        viewModelScope.launch {
            val pondList = ponds.value
            val target = pondList.find { it.id == id }
            if (target != null) {
                repository.updatePond(target.copy(flow = flow, totalizer = totalizer))
            }
        }
    }

    /**
     * Simulator Scenario triggers
     */
    fun triggerScenario(scenario: String) {
        viewModelScope.launch {
            when (scenario) {
                "STEADY_STATE" -> {
                    val updatedPads = pads.value.map {
                        if (it.id == "LP1") it.copy(minFlow = 44.7, maxFlow = 44.7, status = "Active")
                        else if (it.id == "LP4") it.copy(minFlow = 122.0, maxFlow = 122.0, status = "Active")
                        else if (it.id == "LP5") it.copy(minFlow = 155.0, maxFlow = 155.0, status = "Active")
                        else if (it.id == "LP6") it.copy(minFlow = 182.0, maxFlow = 182.0, status = "Active")
                        else if (it.id == "LP7") it.copy(minFlow = 164.0, maxFlow = 164.0, status = "Active")
                        else if (it.id == "LP8") it.copy(minFlow = 94.0, maxFlow = 94.0, status = "Active")
                        else if (it.id == "LP9") it.copy(minFlow = 161.0, maxFlow = 161.0, status = "Active")
                        else if (it.id == "LP11") it.copy(minFlow = 147.0, maxFlow = 147.0, status = "Active")
                        else if (it.id == "LP12") it.copy(minFlow = 133.0, maxFlow = 133.0, status = "Active")
                        else it.copy(minFlow = 0.0, maxFlow = 0.0, status = "Off")
                    }
                    repository.insertLeachPads(updatedPads)
                    _acidTank1Level.value = 45.0
                    _plsPondLevel.value = 65.5
                }
                "WEATHER_SURGE" -> {
                    // Storm/Rain dilution scenario
                    val updatedPads = pads.value.map {
                        if (it.status == "Active") it.copy(minFlow = it.minFlow * 1.35, maxFlow = it.maxFlow * 1.35)
                        else it
                    }
                    repository.insertLeachPads(updatedPads)
                    _plsPondLevel.value = 92.4 // Storm surge fills PLS Pond
                }
                "PUMP_OUTAGE" -> {
                    // Acid tank pump out or mechanical fault
                    val updatedPads = pads.value.map {
                        if (it.feedType == "RAF") it.copy(minFlow = 0.0, maxFlow = 0.0, status = "Off")
                        else it
                    }
                    repository.insertLeachPads(updatedPads)
                    _acidTank1Level.value = 4.2 // Drops critically low
                }
                "RECIRCULATION" -> {
                    // Recirculate intermediate solution
                    val updatedPads = pads.value.map {
                        if (it.id == "LP1" || it.id == "LP2" || it.id == "LP3") {
                            it.copy(minFlow = 85.0, maxFlow = 85.0, status = "Active", feedType = "ILS")
                        } else it
                    }
                    repository.insertLeachPads(updatedPads)
                }
            }
        }
    }

    /**
     * Submits the current telemetry state to Local History
     */
    fun submitShiftReport(notes: String) {
        viewModelScope.launch {
            val sdfDate = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
            val sdfTime = SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date())
            val currentPads = pads.value
            val currentPonds = ponds.value

            // Simplistic mock JSON serialization for storage demonstration
            val padsJson = currentPads.joinToString(";") { "${it.id},${it.minFlow},${it.maxFlow},${it.status},${it.feedType},${it.totalizer}" }
            val pondsJson = currentPonds.joinToString(";") { "${it.id},${it.name},${it.flow},${it.totalizer}" }
            val extraJson = "tank1:${_acidTank1Level.value},tank2:${_acidTank2Level.value},plsPond:${_plsPondLevel.value}"

            val submission = ShiftSubmissionEntity(
                id = _currentShiftId.value,
                date = sdfDate,
                time = sdfTime,
                operatorEmail = _operatorEmail.value,
                operatorName = _operatorName.value,
                employmentNumber = _employmentNumber.value,
                padsJson = padsJson,
                pondsJson = pondsJson,
                extraTelemetryJson = extraJson,
                notes = notes,
                isSynced = false
            )
            repository.submitShift(submission)
            
            // Advance the shift ID for the next entry
            val nextCode = ('A'.code + (Random().nextInt(26))).toChar()
            _currentShiftId.value = "SHIFT-${sdfDate.replace("-", "")}-$nextCode"
        }
    }

    /**
     * Calls Gemini AI or Fallback report generator
     */
    fun generateShiftSummary(apiKey: String, notes: String) {
        viewModelScope.launch {
            _isGeneratingReport.value = true
            val response = repository.generateAiReport(
                apiKey = apiKey,
                pads = pads.value,
                ponds = ponds.value,
                operatorNotes = notes
            )
            _aiReport.value = response
            _isGeneratingReport.value = false
        }
    }
}
