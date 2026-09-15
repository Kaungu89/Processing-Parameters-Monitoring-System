package com.mimbula.telemetry.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.mimbula.telemetry.data.LeachPadEntity
import com.mimbula.telemetry.ui.theme.*
import com.mimbula.telemetry.ui.viewmodel.TelemetryViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LeachPadSpreadsheetScreen(
    viewModel: TelemetryViewModel,
    onBack: () -> Unit
) {
    val pads by viewModel.pads.collectAsState()
    
    // Areas mapping matching web app
    val padAreas = remember {
        mapOf(
            "LP1" to 14200.0,
            "LP2" to 14200.0,
            "LP3" to 15000.0,
            "LP4" to 16000.0,
            "LP5" to 18500.0,
            "LP6" to 18500.0,
            "LP7" to 16400.0,
            "LP8" to 15500.0,
            "LP9" to 16100.0,
            "LP10" to 14200.0,
            "LP11" to 14700.0,
            "LP12" to 13300.0
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = "LEACH PAD FLOW SHEET",
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                        Text(
                            text = "Real-time verification grid",
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
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .background(Slate100)
                .padding(innerPadding)
                .padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item {
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Text(
                            text = "💡 OPERATOR FIELD INSTRUCTIONS",
                            color = Slate900,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = "Ensure flow parameters match local DCS telemetry dials. Values should not exceed 250 m³/h. Toggle the status button to dynamically recalculate aggregate heap saturation rates.",
                            color = Color.DarkGray,
                            fontSize = 12.sp,
                            lineHeight = 16.sp
                        )
                    }
                }
            }

            items(pads, key = { it.id }) { pad ->
                val padArea = padAreas[pad.id] ?: 15000.0
                val avgFlow = (pad.minFlow + pad.maxFlow) / 2.0
                val fluxRate = if (pad.status == "Active" && padArea > 0) (avgFlow * 1000) / padArea else 0.0

                SpreadsheetRowItem(
                    pad = pad,
                    fluxRate = fluxRate,
                    onUpdatePad = { updated ->
                        viewModel.updatePadFlow(updated.id, updated.minFlow, updated.maxFlow, updated.status)
                    }
                )
            }
        }
    }
}

@Composable
fun SpreadsheetRowItem(
    pad: LeachPadEntity,
    fluxRate: Double,
    onUpdatePad: (LeachPadEntity) -> Unit
) {
    var minFlowText by remember(pad.minFlow) { mutableStateOf(pad.minFlow.toString()) }
    var maxFlowText by remember(pad.maxFlow) { mutableStateOf(pad.maxFlow.toString()) }
    
    val isMinGreater = pad.minFlow > pad.maxFlow

    Card(
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(12.dp),
        border = if (isMinGreater) CardDefaults.outlinedCardBorder().copy(brush = androidx.compose.ui.graphics.SolidColor(Color.Red)) else null,
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            // Row Header (ID and Status Toggle)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = pad.id,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = Slate900
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Box(
                        modifier = Modifier
                            .background(
                                color = if (pad.feedType == "RAF") Teal500.copy(alpha = 0.15f) else Slate700.copy(alpha = 0.15f),
                                shape = RoundedCornerShape(4.dp)
                            )
                            .padding(horizontal = 6.dp, java.lang.Integer.max(1, 2).dp)
                    ) {
                        Text(
                            text = pad.feedType,
                            color = if (pad.feedType == "RAF") Teal600 else Slate700,
                            fontSize = 8.5.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace
                        )
                    }
                }

                // Active/Off switch button
                Button(
                    onClick = {
                        val nextStatus = if (pad.status == "Active") "Off" else "Active"
                        onUpdatePad(pad.copy(status = nextStatus))
                    },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (pad.status == "Active") Emerald500 else Color.LightGray
                    ),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 2.dp),
                    shape = RoundedCornerShape(6.dp),
                    modifier = Modifier.height(28.dp)
                ) {
                    Text(
                        text = pad.status.uppercase(),
                        color = Color.White,
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Inputs (Min Flow, Max Flow)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                OutlinedTextField(
                    value = minFlowText,
                    onValueChange = { newVal ->
                        minFlowText = newVal
                        newVal.toDoubleOrNull()?.let {
                            onUpdatePad(pad.copy(minFlow = it))
                        }
                    },
                    label = { Text("Min Flow (m³/h)", fontSize = 10.sp) },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    modifier = Modifier.weight(1f),
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Teal500,
                        unfocusedBorderColor = Color.LightGray
                    )
                )

                OutlinedTextField(
                    value = maxFlowText,
                    onValueChange = { newVal ->
                        maxFlowText = newVal
                        newVal.toDoubleOrNull()?.let {
                            onUpdatePad(pad.copy(maxFlow = it))
                        }
                    },
                    label = { Text("Max Flow (m³/h)", fontSize = 10.sp) },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    modifier = Modifier.weight(1f),
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Teal500,
                        unfocusedBorderColor = Color.LightGray
                    )
                )
            }

            // Warnings and Metrics row
            if (isMinGreater) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "⚠ Error: Minimum flow rate cannot exceed maximum flow rate limit.",
                    color = Color.Red,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace
                )
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Wetting Flux diagnostic
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Estimated Wetting Flux:",
                    color = Color.Gray,
                    fontSize = 11.sp
                )
                Text(
                    text = "${fluxRate.toFixed(2)} L/h/m²",
                    color = if (fluxRate > 0) Teal600 else Color.Gray,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Black,
                    fontFamily = FontFamily.Monospace
                )
            }
        }
    }
}

private fun Double.toFixed(digits: Int): String {
    return String.format("%.${digits}f", this)
}
