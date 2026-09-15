package com.mimbula.telemetry.ui.screens

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import com.mimbula.telemetry.data.LeachPadEntity
import com.mimbula.telemetry.data.PondTelemetryEntity
import com.mimbula.telemetry.ui.theme.*
import com.mimbula.telemetry.ui.viewmodel.TelemetryViewModel
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun DashboardScreen(
    viewModel: TelemetryViewModel,
    onNavigateToSpreadsheet: () -> Unit,
    onNavigateToSimulator: () -> Unit,
    onNavigateToCoPilot: () -> Unit
) {
    val pads by viewModel.pads.collectAsState()
    val ponds by viewModel.ponds.collectAsState()
    val currentShiftId by viewModel.currentShiftId.collectAsState()
    val fohlFlows by viewModel.fohlFlows.collectAsState()

    val acidTank1Level by viewModel.acidTank1Level.collectAsState()
    val plsPondLevel by viewModel.plsPondLevel.collectAsState()

    val totalActiveFlow = pads.filter { it.status == "Active" }.sumOf { it.minFlow }
    val activePadsCount = pads.count { it.status == "Active" }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(Slate100)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Shift Header Card
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = Slate900),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = "MIMBULA TELEMETRY COCKPIT",
                            color = Teal400,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace,
                            letterSpacing = 1.sp
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = currentShiftId,
                            color = Color.White,
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    Box(
                        modifier = Modifier
                            .background(Color.White.copy(alpha = 0.1f), shape = RoundedCornerShape(8.dp))
                            .padding(horizontal = 12.dp, java.lang.Integer.max(1, 6).dp)
                    ) {
                        Text(
                            text = "CAT (UTC+2)",
                            color = Color.White,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace
                        )
                    }
                }
            }
        }

        // Critical Alarms Section
        item {
            AnimatedVisibility(
                visible = acidTank1Level < 15.0,
                enter = fadeIn() + expandVertically(),
                exit = fadeOut() + shrinkVertically()
            ) {
                Card(
                    colors = CardDefaults.cardColors(containerColor = Rose500.copy(alpha = 0.15f)),
                    shape = RoundedCornerShape(12.dp),
                    border = CardDefaults.outlinedCardBorder().copy(brush = androidx.compose.ui.graphics.SolidColor(Rose500)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Text(text = "🚨", fontSize = 24.sp)
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "CRITICAL METALLURGICAL ALARM",
                                color = Rose500,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Black,
                                fontFamily = FontFamily.Monospace
                            )
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                text = "Acid Storage Tank 1 level is critically low at ${acidTank1Level.toFixed(1)}%. Trigger recovery protocols or schedule refinery resupply immediately.",
                                color = Slate900,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Medium
                            )
                        }
                    }
                }
            }
        }

        // Flow Summary & Quick Actions Grid
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Metric 1: Total Flow
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Text(
                            text = "IRRIGATED FLOW",
                            color = Color.Gray,
                            fontSize = 9.sp,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "${totalActiveFlow.toFixed(1)} m³/h",
                            color = Slate900,
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Black
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = "$activePadsCount Active Leach Pads",
                            color = Teal600,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }

                // Metric 2: FOHL Feed
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    val fohlFeed = fohlFlows["fohlFeed"] ?: 0.0
                    Column(modifier = Modifier.padding(14.dp)) {
                        Text(
                            text = "FOHL INLET FEED",
                            color = Color.Gray,
                            fontSize = 9.sp,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "${fohlFeed.toFixed(1)} m³/h",
                            color = Slate900,
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Black
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = if (fohlFeed > 0) "Loop Circulating (LP1)" else "FOHL Offline (LP1 Off)",
                            color = if (fohlFeed > 0) Emerald500 else Color.Red,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }
            }
        }

        // Animated Interactive Hydraulic Flow Schematic (FOHL return cycle)
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = Slate900),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "HYDRAULIC FLOW CIRCUIT SCHEMATIC",
                        color = Teal400,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace,
                        letterSpacing = 1.sp
                    )
                    Spacer(modifier = Modifier.height(12.dp))

                    // Simplified graphic boxes showing recirculations
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        // LP1 Node
                        CircuitNode(
                            title = "LP1 Leach Pad Node",
                            value = "${(pads.find { it.id == "LP1" }?.minFlow ?: 0.0).toFixed(1)} m³/h",
                            isActive = pads.find { it.id == "LP1" }?.status == "Active"
                        )

                        // Arrow Down
                        ArrowIndicator(isActive = pads.find { it.id == "LP1" }?.status == "Active")

                        // FOHL Plant Node
                        CircuitNode(
                            title = "FOHL Process Plant",
                            value = "Inlet Feed: ${(fohlFlows["fohlFeed"] ?: 0.0).toFixed(1)} m³/h",
                            isActive = (fohlFlows["fohlFeed"] ?: 0.0) > 0,
                            isPlant = true
                        )

                        // Arrow Down Splitted
                        ArrowIndicator(isActive = (fohlFlows["fohlFeed"] ?: 0.0) > 0)

                        // Return Destinations
                        Card(
                            colors = CardDefaults.cardColors(containerColor = Slate800),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(modifier = Modifier.padding(10.dp)) {
                                Text(
                                    text = "FOHL Effluent Split Returns (Even distribution):",
                                    color = Color.LightGray,
                                    fontSize = 10.sp,
                                    fontFamily = FontFamily.Monospace,
                                    modifier = Modifier.padding(bottom = 6.dp)
                                )
                                val splitVal = (fohlFlows["fohlReturnLP1"] ?: 0.0).toFixed(1)
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text(text = "LP1: $splitVal m³/h", color = Color.White, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                                    Text(text = "LP2: $splitVal m³/h", color = Color.White, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                                    Text(text = "LP3: $splitVal m³/h", color = Color.White, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                                }
                            }
                        }
                    }
                }
            }
        }

        // Active Ponds Capacities (Vertical Cylinder Progress indicators)
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = Color.White),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "ACID PONDS RESERVOIR LEVELS",
                        color = Slate900,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace,
                        letterSpacing = 1.sp,
                        modifier = Modifier.padding(bottom = 12.dp)
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        // RAF Pond level (Simulated static high level)
                        CylinderPondProgress(name = "RAF Pond", level = 85.4, color = Teal500)
                        // ILS Pond level (Simulated)
                        CylinderPondProgress(name = "ILS Pond", level = 79.5, color = Slate700)
                        // PLS Pond level (Live simulated state)
                        CylinderPondProgress(name = "PLS Pond", level = plsPondLevel, color = Emerald500)
                    }
                }
            }
        }

        // Cockpit Main Actions Buttons
        item {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Button(
                    onClick = onNavigateToSpreadsheet,
                    colors = ButtonDefaults.buttonColors(containerColor = Slate900),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(text = "📊 OPEN FLOW SPREADSHEET GRID", color = Color.White, fontWeight = FontWeight.Bold)
                }

                Button(
                    onClick = onNavigateToSimulator,
                    colors = ButtonDefaults.buttonColors(containerColor = Teal500),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(text = "🧪 DCS SIMULATOR SANDBOX", color = Color.White, fontWeight = FontWeight.Bold)
                }

                Button(
                    onClick = onNavigateToCoPilot,
                    colors = ButtonDefaults.buttonColors(containerColor = Slate700),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(text = "🤖 ASK AI OPERATOR CO-PILOT", color = Color.White, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
fun CircuitNode(title: String, value: String, isActive: Boolean, isPlant: Boolean = false) {
    val bgColor = if (isActive) {
        if (isPlant) Color(0xFF047857) else Slate800
    } else Color(0xFF1E293B).copy(alpha = 0.5f)

    val borderColor = if (isActive) {
        if (isPlant) Teal400 else Teal400
    } else Color.Gray.copy(alpha = 0.3f)

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(bgColor)
            .clickable { }
            .padding(12.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(text = title, color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                Text(text = if (isActive) "FLOW ACTIVE" else "FLOW OFF", color = if (isActive) Teal400 else Color.LightGray, fontSize = 9.sp, fontFamily = FontFamily.Monospace)
            }
            Text(text = value, color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Black, fontFamily = FontFamily.Monospace)
        }
    }
}

@Composable
fun ArrowIndicator(isActive: Boolean) {
    Box(
        modifier = Modifier.fillMaxWidth(),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = "↓",
            fontSize = 18.sp,
            color = if (isActive) Teal400 else Color.Gray,
            fontWeight = FontWeight.Black
        )
    }
}

@Composable
fun CylinderPondProgress(name: String, level: Double, color: Color) {
    Column(
        horizontalAlignment = Alignment.CenterAlignment,
        verticalArrangement = Arrangement.Center,
        modifier = Modifier.padding(horizontal = 8.dp)
    ) {
        Box(
            modifier = Modifier
                .width(55.dp)
                .height(100.dp)
                .clip(RoundedCornerShape(27.dp))
                .background(Slate100)
                .padding(4.dp),
            contentAlignment = Alignment.BottomCenter
        ) {
            // Level fill
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .fillMaxHeight((level / 100).toFloat())
                    .clip(RoundedCornerShape(bottomStart = 23.dp, bottomEnd = 23.dp, topStart = 6.dp, topEnd = 6.dp))
                    .background(color)
            )
            // Label overlay
            Text(
                text = "${level.toFixed(0)}%",
                color = if (level > 40) Color.White else Slate900,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
                modifier = Modifier.padding(bottom = 12.dp)
            )
        }
        Spacer(modifier = Modifier.height(6.dp))
        Text(
            text = name,
            color = Slate900,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold
        )
    }
}

private fun Double.toFixed(digits: Int): String {
    return String.format("%.${digits}f", this)
}
