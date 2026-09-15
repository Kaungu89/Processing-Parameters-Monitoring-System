package com.mimbula.telemetry.data

import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Dao
interface TelemetryDao {
    @Query("SELECT * FROM leach_pads")
    fun getAllLeachPads(): Flow<List<LeachPadEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertLeachPads(pads: List<LeachPadEntity>)

    @Query("SELECT * FROM pond_telemetry")
    fun getAllPonds(): Flow<List<PondTelemetryEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPonds(ponds: List<PondTelemetryEntity>)

    @Query("SELECT * FROM shift_submissions ORDER BY date DESC, time DESC")
    fun getAllSubmissions(): Flow<List<ShiftSubmissionEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSubmission(submission: ShiftSubmissionEntity)

    @Query("DELETE FROM shift_submissions")
    suspend fun clearAllSubmissions()
}

@Database(entities = [LeachPadEntity::class, PondTelemetryEntity::class, ShiftSubmissionEntity::class], version = 1, exportSchema = false)
abstract class AppDatabase : RoomDatabase() {
    abstract fun telemetryDao(): TelemetryDao
}
