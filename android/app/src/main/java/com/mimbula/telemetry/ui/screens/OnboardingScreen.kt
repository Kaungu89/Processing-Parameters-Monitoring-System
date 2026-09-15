package com.mimbula.telemetry.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.mimbula.telemetry.ui.theme.Slate900
import com.mimbula.telemetry.ui.theme.Teal400

data class OnboardingPage(
    val emoji: String,
    val title: String,
    val description: String
)

@Composable
fun OnboardingScreen(onOnboardingComplete: () -> Unit) {
    val pages = remember {
        listOf(
            OnboardingPage(
                "📋",
                "Leach Pad Flow Sheets",
                "Input shift telemetry directly into the digital spreadsheet grid. Built-in smart bounds check input ranges to eliminate data errors before submission."
            ),
            OnboardingPage(
                "🔄",
                "FOHL Recirculation Loops",
                "Monitor chemical flow routing live. Features dedicated tracking of the FOHL process plant return cycle, distributing LP1 active feeds back to LP1, LP2, and LP3."
            ),
            OnboardingPage(
                "🤖",
                "Gemini AI Co-Pilot",
                "Compile professional shift reports instantly. Generates clean executive summaries, hydrological reviews, and recovery action lists with offline local backups."
            )
        )
    }

    var currentPage by remember { mutableStateOf(0) }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(Slate900, Color(0xFF030712))
                )
            ),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(32.dp),
            horizontalAlignment = Alignment.CenterAlignment,
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            // Header
            Text(
                text = "OPERATOR GUIDES",
                color = Teal400,
                fontSize = 11.sp,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold,
                letterSpacing = 2.sp
            )

            Spacer(modifier = Modifier.height(36.dp))

            // Body
            Column(
                horizontalAlignment = Alignment.CenterAlignment,
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.Center
            ) {
                Text(
                    text = pages[currentPage].emoji,
                    fontSize = 72.sp,
                    modifier = Modifier.padding(bottom = 24.dp)
                )
                Text(
                    text = pages[currentPage].title,
                    color = Color.White,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center
                )
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = pages[currentPage].description,
                    color = Color.White.copy(alpha = 0.7f),
                    fontSize = 13.sp,
                    textAlign = TextAlign.Center,
                    lineHeight = 20.sp,
                    modifier = Modifier.padding(horizontal = 16.dp)
                )
            }

            // Indicator and Navigation Row
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 24.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Page indicator dots
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    pages.forEachIndexed { index, _ ->
                        Box(
                            modifier = Modifier
                                .size(if (currentPage == index) 16.dp else 8.dp, 8.dp)
                                .background(
                                    color = if (currentPage == index) Teal400 else Color.White.copy(alpha = 0.3f),
                                    shape = RoundedCornerShape(4.dp)
                                )
                        )
                    }
                }

                // Next / Complete Button
                Button(
                    onClick = {
                        if (currentPage < pages.lastIndex) {
                            currentPage++
                        } else {
                            onOnboardingComplete()
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Teal400),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text(
                        text = if (currentPage == pages.lastIndex) "GET STARTED" else "NEXT",
                        color = Slate900,
                        fontWeight = FontWeight.Bold,
                        fontSize = 12.sp,
                        fontFamily = FontFamily.Monospace
                    )
                }
            }
        }
    }
}
