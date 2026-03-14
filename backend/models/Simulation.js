const mongoose = require('mongoose');

const simulationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    region_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Region',
      required: true,
    },
    type: {
      type: String,
      enum: ['emission_reduction', 'plant_shutdown', 'policy_change', 'weather_scenario'],
      required: true,
    },
    // What we're simulating
    parameters: {
      industries: [
        {
          industry_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Industry' },
          reduction_percent: Number,   // e.g., 30 means reduce by 30%
          shutdown: { type: Boolean, default: false },
        },
      ],
      timeframe_days: { type: Number, default: 7 },
      weather_scenario: {
        wind_speed: Number,
        wind_direction: Number,
        temperature: Number,
        humidity: Number,
      },
    },
    // Results from AI model
    results: {
      status: {
        type: String,
        enum: ['pending', 'running', 'completed', 'failed'],
        default: 'pending',
      },
      baseline: {
        pm25: Number,
        pm10: Number,
        no2: Number,
        so2: Number,
        aqi: Number,
      },
      predicted: {
        pm25: Number,
        pm10: Number,
        no2: Number,
        so2: Number,
        aqi: Number,
      },
      reduction_percent: {
        pm25: Number,
        pm10: Number,
        no2: Number,
        so2: Number,
        aqi: Number,
      },
      health_impact: {
        affected_population: Number,
        health_risk_reduction_percent: Number,
      },
      confidence_score: Number,
      completed_at: Date,
      error_message: String,
    },
    notes: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

simulationSchema.index({ created_by: 1, created_at: -1 });
simulationSchema.index({ region_id: 1 });

module.exports = mongoose.model('Simulation', simulationSchema);
