package com.mimbula.telemetry

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.mimbula.telemetry.ui.screens.*
import com.mimbula.telemetry.ui.theme.MimbulaTelemetryTheme
import com.mimbula.telemetry.ui.viewmodel.TelemetryViewModel
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    private val viewModel: TelemetryViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MimbulaTelemetryTheme {
                Surface(
                    modifier = Modifier.fillMaxSize()
                ) {
                    var currentScreenState by remember { mutableStateOf("SPLASH") }

                    when (currentScreenState) {
                        "SPLASH" -> {
                            SplashScreen(
                                onSplashComplete = {
                                    currentScreenState = "ONBOARDING"
                                }
                            )
                        }
                        "ONBOARDING" -> {
                            OnboardingScreen(
                                onOnboardingComplete = {
                                    currentScreenState = "MAIN"
                                }
                            )
                        }
                        "MAIN" -> {
                            val navController = rememberNavController()
                            NavHost(
                                navController = navController,
                                startDestination = "dashboard",
                                modifier = Modifier.fillMaxSize()
                            ) {
                                composable("dashboard") {
                                    DashboardScreen(
                                        viewModel = viewModel,
                                        onNavigateToSpreadsheet = { navController.navigate("spreadsheet") },
                                        onNavigateToSimulator = { navController.navigate("simulator") },
                                        onNavigateToCoPilot = { navController.navigate("copilot") }
                                    )
                                }
                                composable("spreadsheet") {
                                    LeachPadSpreadsheetScreen(
                                        viewModel = viewModel,
                                        onBack = { navController.popBackStack() }
                                    )
                                }
                                composable("simulator") {
                                    SimulatorSandboxScreen(
                                        viewModel = viewModel,
                                        onBack = { navController.popBackStack() }
                                    )
                                }
                                composable("copilot") {
                                    AiCoPilotScreen(
                                        viewModel = viewModel,
                                        onBack = { navController.popBackStack() },
                                        onNavigateToHistory = { navController.navigate("history") }
                                    )
                                }
                                composable("history") {
                                    HistoricalIndexScreen(
                                        viewModel = viewModel,
                                        onBack = { navController.popBackStack() }
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
