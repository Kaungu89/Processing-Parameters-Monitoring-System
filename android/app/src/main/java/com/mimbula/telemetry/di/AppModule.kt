package com.mimbula.telemetry.di

import android.content.Context
import androidx.room.Room
import com.mimbula.telemetry.data.AppDatabase
import com.mimbula.telemetry.data.TelemetryDao
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): AppDatabase {
        return Room.databaseBuilder(
            context,
            AppDatabase::class.java,
            "mimbula_telemetry_db"
        ).fallbackToDestructiveMigration().build()
    }

    @Provides
    @Singleton
    fun provideTelemetryDao(database: AppDatabase): TelemetryDao {
        return database.telemetryDao()
    }
}
