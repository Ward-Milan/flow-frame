use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ProjectorInput {
    pub x: f64,
    pub y: f64,
    pub z: f64,             // Height in cm
    pub pan: f64,           // Rotation angle in degrees
    pub tilt: f64,          // Tilt downwards (0-85 degrees)
    pub beam_angle: f64,    // 50% intensity cone angle in degrees
    pub field_angle: f64,   // 10% cutoff cone angle in degrees
    pub intensity_cd: f64,  // Candela or peak lux @ 1m
    pub dimmer: f64,        // 0.0 - 100.0%
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct LuxSamplePoint {
    pub x: f64,
    pub y: f64,
    pub lux: f64,
}

#[inline]
fn to_rad(deg: f64) -> f64 {
    deg * PI / 180.0
}

/// Computes exact Lux contribution from a projector at a 2D floor coordinate (x, y, z=0)
/// in meters.
pub fn calculate_lux(proj: &ProjectorInput, floor_x_m: f64, floor_y_m: f64) -> f64 {
    let dimmer_factor = (proj.dimmer / 100.0).clamp(0.0, 1.0);
    if dimmer_factor <= 0.0 || proj.intensity_cd <= 0.0 {
        return 0.0;
    }

    // Convert cm to meters
    let px = proj.x / 100.0;
    let py = proj.y / 100.0;
    let pz = proj.z / 100.0;

    let dx = floor_x_m - px;
    let dy = floor_y_m - py;
    let dz = 0.0 - pz;

    let dist_sq = dx * dx + dy * dy + dz * dz;
    if dist_sq <= 0.01 {
        return 0.0;
    }
    let dist = dist_sq.sqrt();

    let vx = dx / dist;
    let vy = dy / dist;
    let vz = dz / dist;

    // Cinema orientation: pan is azimuth, tilt is elevation angle downwards
    let pan_rad = to_rad(proj.pan);
    let tilt_rad = to_rad(proj.tilt);

    let aim_x = tilt_rad.sin() * pan_rad.sin();
    let aim_y = tilt_rad.sin() * pan_rad.cos();
    let aim_z = -tilt_rad.cos();

    let dot = vx * aim_x + vy * aim_y + vz * aim_z;
    if dot <= 0.0 {
        return 0.0;
    }

    let alpha_deg = dot.acos() * 180.0 / PI;
    let half_beam = proj.beam_angle / 2.0;
    let half_field = (proj.field_angle / 2.0).max(half_beam * 1.3);

    let angular_factor = if alpha_deg <= half_beam {
        1.0 - 0.5 * (alpha_deg / half_beam).powf(1.5)
    } else if alpha_deg <= half_field {
        let t = (alpha_deg - half_beam) / (half_field - half_beam);
        0.5 - 0.4 * t
    } else {
        return 0.0;
    };

    let cos_incidence = vz.abs();
    let effective_intensity = proj.intensity_cd * dimmer_factor;
    (effective_intensity / dist_sq) * cos_incidence * angular_factor
}

/// Tauri command: Calculates ground lux for a batch of sample points
#[tauri::command]
pub fn calculate_ground_lux(
    projectors: Vec<ProjectorInput>,
    sample_points: Vec<(f64, f64)>,
) -> Vec<LuxSamplePoint> {
    sample_points
        .into_iter()
        .map(|(x_cm, y_cm)| {
            let x_m = x_cm / 100.0;
            let y_m = y_cm / 100.0;
            let mut total_lux = 0.0;
            for p in &projectors {
                total_lux += calculate_lux(p, x_m, y_m);
            }
            LuxSamplePoint {
                x: x_cm,
                y: y_cm,
                lux: (total_lux * 10.0).round() / 10.0,
            }
        })
        .collect()
}

