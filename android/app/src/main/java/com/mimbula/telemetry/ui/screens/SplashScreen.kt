package com.mimbula.telemetry.ui.screens

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.mimbula.telemetry.ui.theme.Slate900
import com.mimbula.telemetry.ui.theme.Teal400
import kotlinx.coroutines.delay

@Composable
fun SplashScreen(onSplashComplete: () -> Unit) {
    val scale = remember { Animatable(0.5f) }
    val alpha = remember { Animatable(0f) }

    LaunchedEffect(key1 = true) {
        alpha.animateTo(
            targetValue = 1f,
            animationSpec = tween(
                durationMillis = 1000,
                easing = FastOutSlowInEasing
            )
        )
        scale.animateTo(
            targetValue = 1f,
            animationSpec = tween(
                durationMillis = 1000,
                easing = OvershootInterpolator(1.5f)::getInterpolation
            )
        )
        delay(1200) // Keep visible for a moment
        onSplashComplete()
    }

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
            horizontalAlignment = Alignment.CenterAlignment,
            verticalArrangement = Arrangement.Center,
            modifier = Modifier.padding(24.dp)
        ) {
            // High-end minimalist vector logo
            Box(
                modifier = Modifier
                    .size(80.dp)
                    .scale(scale.value)
                    .alpha(alpha.value)
                    .background(Color.White.copy(alpha = 0.05f), shape = androidx.compose.foundation.shape.CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "🧪",
                    fontSize = 42.sp
                )
            }
            Spacer(modifier = Modifier.height(24.dp))
            Text(
                text = "MIMBULA MINERALS",
                color = Color.White,
                fontSize = 22.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 2.sp,
                modifier = Modifier.alpha(alpha.value)
            )
            Spacer(modifier = Modifier.height(6.dp))
            Text(
                text = "Processing Telemetry Co-Pilot",
                color = Teal400,
                fontSize = 12.sp,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Medium,
                letterSpacing = 1.sp,
                modifier = Modifier.alpha(alpha.value)
            )
        }
    }
}

// Simple interpolator helper for Compose
private class OvershootInterpolator(private val tension: Float) {
    fun getInterpolation(t: Float): Float {
        var x = t - 1.0f
        return x * x * ((tension + 1) * x + tension) + 1.0f
    }
}
