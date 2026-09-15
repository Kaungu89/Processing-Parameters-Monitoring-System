package com.mimbula.telemetry.data

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "shift_submissions")
data class ShiftSubmissionEntity(
    @PrimaryKey val id: String, // e.g. "SHIFT-2026-07-13-A"
    val date: String,
    val time: String,
    val operatorEmail: String,
    val operatorName: String,
    val employmentNumber: String,
    val padsJson: String, // List of LeachPads serialized as JSON
    val pondsJson: String, // List of Ponds serialized as JSON
    val extraTelemetryJson: String, // Extra telemetry JSON
    val notes: String = "",
    val isSynced: Boolean = false
)
