//! Pure Web Vitals thresholds residual —
//! dual-oracle of `packages/sdk/src/constants.ts` + `web-vitals` rating pure halves.
//!
//! Browser PerformanceObserver / reporting I/O remain product residual.
//! NO authority_rust / ts_deleted invent.

/// Dual-oracle of FCP good/poor thresholds (ms).
pub const WEB_VITALS_FCP_GOOD_MS: f64 = 1_800.0;
pub const WEB_VITALS_FCP_POOR_MS: f64 = 3_000.0;
/// Dual-oracle of LCP good/poor thresholds (ms).
pub const WEB_VITALS_LCP_GOOD_MS: f64 = 2_500.0;
pub const WEB_VITALS_LCP_POOR_MS: f64 = 4_000.0;
/// Dual-oracle of INP good/poor thresholds (ms).
pub const WEB_VITALS_INP_GOOD_MS: f64 = 200.0;
pub const WEB_VITALS_INP_POOR_MS: f64 = 500.0;
/// Dual-oracle of TTFB good/poor thresholds (ms).
pub const WEB_VITALS_TTFB_GOOD_MS: f64 = 800.0;
pub const WEB_VITALS_TTFB_POOR_MS: f64 = 1_800.0;
/// Dual-oracle of CLS good/poor thresholds (unitless score).
pub const WEB_VITALS_CLS_GOOD: f64 = 0.1;
pub const WEB_VITALS_CLS_POOR: f64 = 0.25;

/// Dual-oracle residual metric rating.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MetricRating {
    Good,
    NeedsImprovement,
    Poor,
}

impl MetricRating {
    #[must_use]
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Good => "good",
            Self::NeedsImprovement => "needs-improvement",
            Self::Poor => "poor",
        }
    }
}

/// Dual-oracle residual metric names.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WebVitalName {
    Lcp,
    Inp,
    Cls,
    Fcp,
    Ttfb,
}

/// Dual-oracle of threshold pair for a metric.
#[must_use]
pub fn thresholds_for(name: WebVitalName) -> (f64, f64) {
    match name {
        WebVitalName::Lcp => (WEB_VITALS_LCP_GOOD_MS, WEB_VITALS_LCP_POOR_MS),
        WebVitalName::Inp => (WEB_VITALS_INP_GOOD_MS, WEB_VITALS_INP_POOR_MS),
        WebVitalName::Cls => (WEB_VITALS_CLS_GOOD, WEB_VITALS_CLS_POOR),
        WebVitalName::Fcp => (WEB_VITALS_FCP_GOOD_MS, WEB_VITALS_FCP_POOR_MS),
        WebVitalName::Ttfb => (WEB_VITALS_TTFB_GOOD_MS, WEB_VITALS_TTFB_POOR_MS),
    }
}

/// Dual-oracle of `getRating(name, value)`.
#[must_use]
pub fn get_rating(name: WebVitalName, value: f64) -> MetricRating {
    let (good, poor) = thresholds_for(name);
    if value <= good {
        MetricRating::Good
    } else if value <= poor {
        MetricRating::NeedsImprovement
    } else {
        MetricRating::Poor
    }
}

/// Dual-oracle residual score contribution (good=100, needs-improvement=50, poor=0).
#[must_use]
pub fn rating_score_points(rating: MetricRating) -> u32 {
    match rating {
        MetricRating::Good => 100,
        MetricRating::NeedsImprovement => 50,
        MetricRating::Poor => 0,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn web_vitals_thresholds_dual_oracle() {
        assert_eq!(WEB_VITALS_FCP_GOOD_MS, 1_800.0);
        assert_eq!(WEB_VITALS_LCP_POOR_MS, 4_000.0);
        assert_eq!(WEB_VITALS_INP_GOOD_MS, 200.0);
        assert_eq!(WEB_VITALS_CLS_GOOD, 0.1);
        assert_eq!(get_rating(WebVitalName::Lcp, 2000.0), MetricRating::Good);
        assert_eq!(
            get_rating(WebVitalName::Lcp, 3000.0),
            MetricRating::NeedsImprovement
        );
        assert_eq!(get_rating(WebVitalName::Lcp, 5000.0), MetricRating::Poor);
        assert_eq!(get_rating(WebVitalName::Cls, 0.05), MetricRating::Good);
        assert_eq!(
            get_rating(WebVitalName::Cls, 0.2),
            MetricRating::NeedsImprovement
        );
        assert_eq!(get_rating(WebVitalName::Cls, 0.5), MetricRating::Poor);
        assert_eq!(rating_score_points(MetricRating::Good), 100);
        assert_eq!(rating_score_points(MetricRating::NeedsImprovement), 50);
        assert_eq!(MetricRating::Poor.as_str(), "poor");
    }
}


// ── wave68 pure residual dens: web-vitals threshold ladder dual-oracle residual ──
// Dual-oracle residual of FCP/LCP/INP/TTFB/CLS good/poor thresholds pure half.
// Tracker / network flush I/O residual retained. dens ≠ flip.

/// Dual-oracle residual: FCP good/poor shell.
#[must_use]
pub fn fcp_threshold_shell() -> (f64, f64) {
    (WEB_VITALS_FCP_GOOD_MS, WEB_VITALS_FCP_POOR_MS)
}

/// Dual-oracle residual: LCP good/poor shell.
#[must_use]
pub fn lcp_threshold_shell() -> (f64, f64) {
    (WEB_VITALS_LCP_GOOD_MS, WEB_VITALS_LCP_POOR_MS)
}

/// Dual-oracle residual: INP good/poor shell.
#[must_use]
pub fn inp_threshold_shell() -> (f64, f64) {
    (WEB_VITALS_INP_GOOD_MS, WEB_VITALS_INP_POOR_MS)
}

/// Dual-oracle residual: TTFB good/poor shell.
#[must_use]
pub fn ttfb_threshold_shell() -> (f64, f64) {
    (WEB_VITALS_TTFB_GOOD_MS, WEB_VITALS_TTFB_POOR_MS)
}

/// Dual-oracle residual: CLS good/poor shell.
#[must_use]
pub fn cls_threshold_shell() -> (f64, f64) {
    (WEB_VITALS_CLS_GOOD, WEB_VITALS_CLS_POOR)
}

/// Dual-oracle residual: good thresholds strictly below poor for all vitals.
#[must_use]
pub fn good_strictly_below_poor() -> bool {
    WEB_VITALS_FCP_GOOD_MS < WEB_VITALS_FCP_POOR_MS
        && WEB_VITALS_LCP_GOOD_MS < WEB_VITALS_LCP_POOR_MS
        && WEB_VITALS_INP_GOOD_MS < WEB_VITALS_INP_POOR_MS
        && WEB_VITALS_TTFB_GOOD_MS < WEB_VITALS_TTFB_POOR_MS
        && WEB_VITALS_CLS_GOOD < WEB_VITALS_CLS_POOR
}

/// Dual-oracle residual: score points ladder good/needs/poor.
#[must_use]
pub fn rating_score_ladder() -> [u32; 3] {
    [
        rating_score_points(MetricRating::Good),
        rating_score_points(MetricRating::NeedsImprovement),
        rating_score_points(MetricRating::Poor),
    ]
}

#[cfg(test)]
mod wave68_tests {
    use super::*;

    #[test]
    fn wave68_web_vitals_threshold_ladder_dual_oracle() {
        assert_eq!(fcp_threshold_shell(), (1_800.0, 3_000.0));
        assert_eq!(lcp_threshold_shell(), (2_500.0, 4_000.0));
        assert_eq!(inp_threshold_shell(), (200.0, 500.0));
        assert_eq!(ttfb_threshold_shell(), (800.0, 1_800.0));
        assert_eq!(cls_threshold_shell(), (0.1, 0.25));
        assert!(good_strictly_below_poor());
        assert_eq!(rating_score_ladder(), [100, 50, 0]);
        assert_eq!(get_rating(WebVitalName::Fcp, 1000.0), MetricRating::Good);
        assert_eq!(get_rating(WebVitalName::Ttfb, 2000.0), MetricRating::Poor);
        assert_eq!(thresholds_for(WebVitalName::Inp), (200.0, 500.0));
        assert_eq!(MetricRating::Good.as_str(), "good");
    }
}
