package com.mimbula.telemetry.data

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "leach_pads")
data class LeachPadEntity(
    @PrimaryKey val id: String, // e.g. "LP1", "LP2"
    val minFlow: Double,
    val maxFlow: Double,
    val status: String, // "Active", "Off", "Offline"
    val feedType: String, // "RAF", "ILS"
    val dischargePlsPercent: Int,
    val dischargeIlsPercent: Int,
    val notes: String = "",
    val totalizer: Double = 0.0
)
