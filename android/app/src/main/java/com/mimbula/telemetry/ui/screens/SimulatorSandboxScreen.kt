package com.mimbula.telemetry.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.mimbula.telemetry.ui.theme.*
import com.mimbula.telemetry.ui.viewmodel.TelemetryViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SimulatorSandboxScreen(
    viewModel: TelemetryViewModel,
    onBack: () -> Unit
) {
    var simulatorStatusMessage by remember { mutableStateOf("DCS Simulator standing by. Select a scenario below.") }
    var isSimulatingState by remember { mutableStateOf(false) }
    val coroutineScope = rememberCoroutineScope()

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = "DCS OPERATIONAL SANDBOX",
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                        Text(
                            text = "Real-time process deviations trigger",
                            fontSize = 10.sp,
                            fontFamily = FontFamily.Monospace,
                            color = Teal400
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Text(text = "←", color = Color.White, fontSize = 20.sp)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Slate900)
            )
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(Slate100)
                .padding(innerPadding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Simulator Status Board (Live terminal-style view)
            Card(
                colors = CardDefaults.cardColors(containerColor = Slate900),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "LIVE TELEMETRY DEV TERMINAL",
                        color = Teal400,
                        fontSize = 9.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        text = simulatorStatusMessage,
                        color = Color.White,
                        fontSize = 13.sp,
                        fontFamily = FontFamily.Monospace,
                        lineHeight = 18.sp
                    )
                    if (isSimulatingState) {
                        Spacer(modifier = Modifier.height(12.dp))
                        LinearProgressIndicator(
                            modifier = Modifier.fillMaxWidth(),
                            color = Teal400,
                            trackColor = Slate800
                        )
                    }
                }
            }

            Text(
                text = "SELECT OPERATIONAL SCENARIO TO INJECT",
                color = Color.Gray,
                fontSize = 11.sp,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(top = 8.dp)
            )

            // Scenarios Buttons Grid
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Scenario 1: Steady State
                ScenarioCard(
                    title = "Scenario 1: Nominal Steady State",
                    description = "Restores all leach pads and acid tanks to designed baseline flow calibrations. Safe, stabilized parameters.",
                    emoji = "🟢",
                    onClick = {
                        coroutineScope.launch {
                            isSimulatingState = true
                            simulatorStatusMessage = "INJECTING: Nominal Steady State calibrations..."
                            delay(1000)
                            viewModel.triggerScenario("STEADY_STATE")
                            isSimulatingState = false
                            simulatorStatusMessage = "SUCCESS: Nominal calibrations restored. Flow rates matching standard 28-May shift baseline. Acid Tank levels restored."
                        }
                    }
                )

                // Scenario 2: Weather Surge
                ScenarioCard(
                    title = "Scenario 2: Extreme Weather Storm Surge",
                    description = "Simulates intense monsoon rainfall. Dilution triggers sudden 35% flow volume surges and PLS level overflows.",
                    emoji = "⛈",
                    onClick = {
                        coroutineScope.launch {
                            isSimulatingState = true
                            simulatorStatusMessage = "INJECTING: Heavy Rainfall precipitation surge..."
                            delay(1000)
                            viewModel.triggerScenario("WEATHER_SURGE")
                            isSimulatingState = false
                            simulatorStatusMessage = "WARNING: Storm surge active. Flow rates increased by 35%. PLS Pond levels spiked to 92.4% capacity. Monitor discharge pipelines."
                        }
                    }
                )

                // Scenario 3: Acid Pump Outage
                ScenarioCard(
                    title = "Scenario 3: Raffinate Acid Pump Outage",
                    description = "Trips mechanical feed lines. Drops RAF acid lines to zero flow and triggers critical refinery resupply alarms.",
                    emoji = "🛑",
                    onClick = {
                        coroutineScope.launch {
                            isSimulatingState = true
                            simulatorStatusMessage = "INJECTING: Raffinate feed mechanical pump trip..."
                            delay(1000)
                            viewModel.triggerScenario("PUMP_OUTAGE")
                            isSimulatingState = false
                            simulatorStatusMessage = "CRITICAL: Raffinate pump tripped. All RAF lines dropped to 0 m³/h. Acid storage level dropped to 4.2%. Visual alarms active."
                        }
                    }
                )

                // Scenario 4: Recirculation
                ScenarioCard(
                    title = "Scenario 4: Recirculation Loop Irrigation",
                    description = "Sets LP1, LP2, LP3 to Recirculation ILS feed. Ideal for managing acid reserves under low supply limits.",
                    emoji = "🔄",
                    onClick = {
                        coroutineScope.launch {
                            isSimulatingState = true
                            simulatorStatusMessage = "INJECTING: Recirculation circuit loop state..."
                            delay(1000)
                            viewModel.triggerScenario("RECIRCULATION")
                            isSimulatingState = false
                            simulatorStatusMessage = "SUCCESS: Intermediate Recirculation enabled. LP1, LP2, LP3 running actively on ILS feeds to save raw sulfuric acid consumption."
                        }
                    }
                )
            }
        }
    }
}

@Composable
fun ScenarioCard(
    title: String,
    description: String,
    emoji: String,
    onClick: () -> Unit
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(text = emoji, fontSize = 28.sp)
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    color = Slate900,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = description,
                    color = Color.Gray,
                    fontSize = 11.sp,
                    lineHeight = 15.sp
                )
            }
        }
    }
}
