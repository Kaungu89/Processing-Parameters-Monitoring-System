package com.mimbula.telemetry.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
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
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AiCoPilotScreen(
    viewModel: TelemetryViewModel,
    onBack: () -> Unit,
    onNavigateToHistory: () -> Unit
) {
    var operatorNotesInput by remember { mutableStateOf("") }
    var userApiKeyInput by remember { mutableStateOf("") } // In practice, managed securely or injected from .env

    val aiReport by viewModel.aiReport.collectAsState()
    val isGeneratingReport by viewModel.isGeneratingReport.collectAsState()
    val coroutineScope = rememberCoroutineScope()
    val scrollState = rememberScrollState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = "GEMINI AI SHIFT CO-PILOT",
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                        Text(
                            text = "Auto-generate official shift logs",
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
                .padding(16.dp)
                .verticalScroll(scrollState),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Informational header
            Card(
                colors = CardDefaults.cardColors(containerColor = Color.White),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Text(
                        text = "🤖 SHIFT TELEMETRY SUMMARIZER",
                        color = Slate900,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = "Generates a comprehensive Metallurgical shift review including active pad capacity trends, the FOHL process recirculation loop health, and next-shift safety recommendations. If no API key is specified, compiles with our local offline fallback rules.",
                        color = Color.DarkGray,
                        fontSize = 12.sp,
                        lineHeight = 16.sp
                    )
                }
            }

            // Input Fields
            OutlinedTextField(
                value = userApiKeyInput,
                onValueChange = { userApiKeyInput = it },
                label = { Text("Gemini API Key (Optional)", fontSize = 11.sp) },
                placeholder = { Text("Enter private key or leave blank for local fallback") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Teal500,
                    unfocusedBorderColor = Color.LightGray
                )
            )

            OutlinedTextField(
                value = operatorNotesInput,
                onValueChange = { operatorNotesInput = it },
                label = { Text("Operator Shift Observations", fontSize = 11.sp) },
                placeholder = { Text("Describe specific cell observations, visual leaks, or valve issues discovered during field walk...") },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(100.dp),
                maxLines = 4,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Teal500,
                    unfocusedBorderColor = Color.LightGray
                )
            )

            // Submit / Action row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Button(
                    onClick = {
                        viewModel.generateShiftSummary(userApiKeyInput, operatorNotesInput)
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Slate900),
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier.weight(1f),
                    enabled = !isGeneratingReport
                ) {
                    Text(
                        text = if (isGeneratingReport) "GENERATING REPORT..." else "🤖 RUN AI REPORT",
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 12.sp,
                        fontFamily = FontFamily.Monospace
                    )
                }

                Button(
                    onClick = {
                        viewModel.submitShiftReport(operatorNotesInput)
                        operatorNotesInput = ""
                        onNavigateToHistory()
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Teal500),
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier.weight(1f),
                    enabled = !isGeneratingReport
                ) {
                    Text(
                        text = "💾 ARCHIVE REPORT",
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 12.sp,
                        fontFamily = FontFamily.Monospace
                    )
                }
            }

            // Report Results Output Card
            if (aiReport.isNotBlank()) {
                Card(
                    colors = CardDefaults.cardColors(containerColor = Slate900),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "OUTPUT REPORT PANEL",
                                color = Teal400,
                                fontSize = 10.sp,
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = "COMPILED ✔",
                                color = Emerald500,
                                fontSize = 9.sp,
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        Spacer(modifier = Modifier.height(14.dp))
                        Text(
                            text = aiReport,
                            color = Color.White,
                            fontSize = 12.sp,
                            lineHeight = 18.sp,
                            fontFamily = FontFamily.SansSerif
                        )
                    }
                }
            }
        }
    }
}
