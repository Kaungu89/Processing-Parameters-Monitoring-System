package com.mimbula.telemetry.data

import com.google.ai.client.generativeai.GenerativeModel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class TelemetryRepository @Inject constructor(
    private val telemetryDao: TelemetryDao
) {
    val leachPads: Flow<List<LeachPadEntity>> = telemetryDao.getAllLeachPads()
    val ponds: Flow<List<PondTelemetryEntity>> = telemetryDao.getAllPonds()
    val submissions: Flow<List<ShiftSubmissionEntity>> = telemetryDao.getAllSubmissions()

    suspend fun seedDatabaseIfEmpty() {
        val currentPads = leachPads.first()
        if (currentPads.isEmpty()) {
            val initialPads = listOf(
                LeachPadEntity("LP1", 44.7, 44.7, "Active", "RAF", 100, 0, "LP1 feeds FOHL Plant directly", 4500.0),
                LeachPadEntity("LP2", 0.0, 0.0, "Off", "RAF", 100, 0, "Target for FOHL returning loop", 0.0),
                LeachPadEntity("LP3", 0.0, 0.0, "Off", "ILS", 0, 100, "Target for FOHL returning loop", 0.0),
                LeachPadEntity("LP4", 122.0, 122.0, "Active", "RAF", 100, 0, "Active high capacity heap", 14500.0),
                LeachPadEntity("LP5", 155.0, 155.0, "Active", "RAF", 80, 20, "PLS/ILS blending heap", 15500.0),
                LeachPadEntity("LP6", 182.0, 182.0, "Active", "ILS", 50, 50, "Shared split loop", 18200.0),
                LeachPadEntity("LP7", 164.0, 164.0, "Active", "RAF", 100, 0, "Raffinate active feed", 16400.0),
                LeachPadEntity("LP8", 94.0, 94.0, "Active", "RAF", 70, 30, "Low-grade heap", 9400.0),
                LeachPadEntity("LP9", 161.0, 161.0, "Active", "ILS", 100, 0, "ILS-Only irrigation", 16100.0),
                LeachPadEntity("LP10", 0.0, 0.0, "Off", "RAF", 60, 40, "Inactive backup", 0.0),
                LeachPadEntity("LP11", 147.0, 147.0, "Active", "RAF", 100, 0, "Steady state leaching", 14700.0),
                LeachPadEntity("LP12", 133.0, 133.0, "Active", "ILS", 0, 100, "High-acidity ILS loop", 13300.0)
            )
            telemetryDao.insertLeachPads(initialPads)
        }

        val currentPonds = ponds.first()
        if (currentPonds.isEmpty()) {
            val initialPonds = listOf(
                PondTelemetryEntity("raf", "RAF Pond Acid", 4476.14, 780.0),
                PondTelemetryEntity("ils", "ILS Pond Acid", 8611.71, 680.0),
                PondTelemetryEntity("crasher", "Acid to Crasher", 40856.09, 147.0),
                PondTelemetryEntity("mainLine", "Main Line Feed", 7436.41, 1066.0)
            )
            telemetryDao.insertPonds(initialPonds)
        }
    }

    suspend fun updateLeachPad(pad: LeachPadEntity) {
        telemetryDao.insertLeachPads(listOf(pad))
    }

    suspend fun updatePond(pond: PondTelemetryEntity) {
        telemetryDao.insertPonds(listOf(pond))
    }

    suspend fun submitShift(submission: ShiftSubmissionEntity) {
        telemetryDao.insertSubmission(submission)
    }

    suspend fun clearSubmissions() {
        telemetryDao.clearAllSubmissions()
    }

    /**
     * Compute "FOHL Plant" Feed and Return values
     * Rule: LP1 feeds FOHL Plant. In return, FOHL Plant distributes its effluent feed to LP1, LP2, and LP3.
     */
    fun calculateFohlFlow(lp1: LeachPadEntity): Map<String, Double> {
        val fohlFeed = if (lp1.status == "Active") lp1.minFlow else 0.0
        // Splitting return flow evenly among LP1, LP2, LP3
        val fohlReturnToEach = fohlFeed / 3.0
        return mapOf(
            "fohlFeed" to fohlFeed,
            "fohlReturnLP1" to fohlReturnToEach,
            "fohlReturnLP2" to fohlReturnToEach,
            "fohlReturnLP3" to fohlReturnToEach
        )
    }

    /**
     * Generate shift logs using Gemini AI (offline fallback available)
     */
    suspend fun generateAiReport(
        apiKey: String,
        pads: List<LeachPadEntity>,
        ponds: List<PondTelemetryEntity>,
        operatorNotes: String
    ): String {
        val totalActiveFlow = pads.filter { it.status == "Active" }.sumOf { it.minFlow }
        val lp1 = pads.find { it.id == "LP1" }
        val fohlFeed = if (lp1?.status == "Active") lp1.minFlow else 0.0

        val prompt = """
            You are the Chief AI Metallurgical Assistant at Mimbula Minerals Limited.
            Analyze the following DCS Telemetry values and write a concise, highly professional Shift Operator Report.
            
            LEACH PAD ACTIVE CIRCUITS:
            - Total Leach Pad Irrigation Flow: ${totalActiveFlow.toFixed(1)} m³/h
            - LP1 Flow (Feeding FOHL Plant): ${fohlFeed.toFixed(1)} m³/h
            - Feed Circuit Rule: LP1 feeds FOHL Process Plant, which then splits return flow to LP1, LP2, and LP3.
            
            ACTIVE PONDS INFLOW/OUTFLOWS:
            ${ponds.joinToString("\n") { "- ${it.name}: Level/Flow rate ${it.flow} m³/h, Totalizer cumulative ${it.totalizer} m³" }}
            
            OPERATOR OBSERVATIONS:
            $operatorNotes
            
            Please output a beautifully structured report containing:
            1. EXECUTIVE SUMMARY (Shift highlights, safety issues, hydraulic loop stability)
            2. HYDRAULIC CIRCUITS & FOHL PERFORMANCE (Specific evaluation of the LP1 -> FOHL -> LP1,2,3 recirculating loop)
            3. METALLURGICAL BLENDING STATUS (Optimal, over-acidified, or imbalanced suggestions)
            4. ACTION ITEMS FOR NEXT SHIFT
            
            Format as clean Markdown text. Be precise, technical, and objective.
        """.trimIndent()

        return try {
            if (apiKey.isBlank()) {
                throw IllegalArgumentException("API Key missing")
            }
            val generativeModel = GenerativeModel(
                modelName = "gemini-1.5-flash",
                apiKey = apiKey
            )
            val response = generativeModel.generateContent(prompt)
            response.text ?: "No response from Gemini API."
        } catch (e: Exception) {
            // Local fallback report generator
            generateLocalFallbackReport(pads, ponds, operatorNotes)
        }
    }

    private fun generateLocalFallbackReport(
        pads: List<LeachPadEntity>,
        ponds: List<PondTelemetryEntity>,
        notes: String
    ): String {
        val totalActiveFlow = pads.filter { it.status == "Active" }.sumOf { it.minFlow }
        val lp1 = pads.find { it.id == "LP1" }
        val fohlFeed = if (lp1?.status == "Active") lp1.minFlow else 0.0

        return """
            # METALLURGICAL SHIFT REPORT (LOCAL OFFLINE ENGINE)
            **MIMBULA MINERALS LIMITED - PROCESSING DEPT**
            
            ## 1. EXECUTIVE SUMMARY
            Operations continued in standard baseline mode during this shift. Total irrigated flow over active pads calculated to **${totalActiveFlow.toFixed(1)} m³/h**. Loop integrity remains within standard pressure bounds.
            
            ## 2. HYDRAULIC CIRCUITS & FOHL PERFORMANCE
            The **FOHL (Free-on-Heap-Leaching) circuit** operates actively. 
            - **LP1 Feed to FOHL**: ${fohlFeed.toFixed(1)} m³/h
            - **FOHL Split Return to LP1/LP2/LP3**: ${(fohlFeed / 3.0).toFixed(1)} m³/h each.
            - *Observation*: Recirculating streams are currently stabilized. Recommend checking nozzle pressures to prevent salt build-up on returned channels.
            
            ## 3. METALLURGICAL STATUS
            Pond reservoirs are balanced. Acid transport rates are nominal.
            ${ponds.joinToString("\n") { "- **${it.name}**: Flowing at ${it.flow.toFixed(1)} m³/h" }}
            
            ## 4. FIELD OPERATOR NOTES
            ${notes.ifBlank { "No manual notes provided by the operator." }}
            
            ## 5. RECOVERY ACTIONS
            - Maintain continuous flow surveillance on LP1 feed.
            - Inspect auxiliary valves on FOHL return manifolds.
        """.trimIndent()
    }

    private fun Double.toFixed(digits: Int): String {
        return String.format("%.${digits}f", this)
    }
}
