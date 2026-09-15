package com.mimbula.telemetry.data

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "pond_telemetry")
data class PondTelemetryEntity(
    @PrimaryKey val id: String, // e.g. "raf", "ils", "crasher", "mainLine"
    val name: String,
    val totalizer: Double,
    val flow: Double
)
