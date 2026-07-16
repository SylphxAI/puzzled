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


// ── wave71 pure residual dens: web-vitals rating edges dual-oracle residual ──
// Dual-oracle residual of web-vitals thresholds pure halves.
// Browser PerformanceObserver residual retained. dens ≠ flip.

/// Dual-oracle residual: FCP edge ratings at good/poor.
#[must_use]
pub fn fcp_rating_edge_shell() -> bool {
    get_rating(WebVitalName::Fcp, WEB_VITALS_FCP_GOOD_MS) == MetricRating::Good
        && get_rating(WebVitalName::Fcp, WEB_VITALS_FCP_GOOD_MS + 1.0)
            == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Fcp, WEB_VITALS_FCP_POOR_MS) == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Fcp, WEB_VITALS_FCP_POOR_MS + 1.0) == MetricRating::Poor
}

/// Dual-oracle residual: CLS unitless edges.
#[must_use]
pub fn cls_rating_edge_shell() -> bool {
    get_rating(WebVitalName::Cls, WEB_VITALS_CLS_GOOD) == MetricRating::Good
        && get_rating(WebVitalName::Cls, WEB_VITALS_CLS_POOR) == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Cls, WEB_VITALS_CLS_POOR + 0.01) == MetricRating::Poor
}

/// Dual-oracle residual: rating wire strings.
#[must_use]
pub fn rating_wire_strings_shell() -> bool {
    MetricRating::Good.as_str() == "good"
        && MetricRating::NeedsImprovement.as_str() == "needs-improvement"
        && MetricRating::Poor.as_str() == "poor"
}

/// Dual-oracle residual: score points ladder 100/50/0.
#[must_use]
pub fn score_points_ladder_shell() -> bool {
    rating_score_ladder() == [100, 50, 0]
}

/// Dual-oracle residual: LCP good below FCP poor (cross-metric honesty).
#[must_use]
pub fn lcp_between_fcp_shell() -> bool {
    WEB_VITALS_FCP_GOOD_MS < WEB_VITALS_LCP_GOOD_MS
        && WEB_VITALS_LCP_GOOD_MS < WEB_VITALS_LCP_POOR_MS
}

#[cfg(test)]
mod wave71_tests {
    use super::*;

    #[test]
    fn wave71_web_vitals_rating_edges_dual_oracle() {
        assert!(fcp_rating_edge_shell());
        assert!(cls_rating_edge_shell());
        assert!(rating_wire_strings_shell());
        assert!(score_points_ladder_shell());
        assert!(lcp_between_fcp_shell());
        assert!(good_strictly_below_poor());
        assert_eq!(thresholds_for(WebVitalName::Inp), (200.0, 500.0));
    }
}

// ── wave72 pure residual dens: web-vitals LCP/INP/TTFB edges dual-oracle residual ──
// Dual-oracle residual of LCP/INP/TTFB rating edges pure halves.
// Browser PerformanceObserver residual retained. dens ≠ flip.

/// Dual-oracle residual: LCP rating edges.
#[must_use]
pub fn lcp_rating_edge_shell() -> bool {
    get_rating(WebVitalName::Lcp, WEB_VITALS_LCP_GOOD_MS) == MetricRating::Good
        && get_rating(WebVitalName::Lcp, WEB_VITALS_LCP_GOOD_MS + 1.0)
            == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Lcp, WEB_VITALS_LCP_POOR_MS)
            == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Lcp, WEB_VITALS_LCP_POOR_MS + 1.0) == MetricRating::Poor
}

/// Dual-oracle residual: INP rating edges.
#[must_use]
pub fn inp_rating_edge_shell() -> bool {
    get_rating(WebVitalName::Inp, WEB_VITALS_INP_GOOD_MS) == MetricRating::Good
        && get_rating(WebVitalName::Inp, WEB_VITALS_INP_GOOD_MS + 1.0)
            == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Inp, WEB_VITALS_INP_POOR_MS)
            == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Inp, WEB_VITALS_INP_POOR_MS + 1.0) == MetricRating::Poor
}

/// Dual-oracle residual: TTFB rating edges.
#[must_use]
pub fn ttfb_rating_edge_shell() -> bool {
    get_rating(WebVitalName::Ttfb, WEB_VITALS_TTFB_GOOD_MS) == MetricRating::Good
        && get_rating(WebVitalName::Ttfb, WEB_VITALS_TTFB_GOOD_MS + 1.0)
            == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Ttfb, WEB_VITALS_TTFB_POOR_MS)
            == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Ttfb, WEB_VITALS_TTFB_POOR_MS + 1.0) == MetricRating::Poor
}

/// Dual-oracle residual: threshold pairs match constants.
#[must_use]
pub fn thresholds_pair_shell() -> bool {
    thresholds_for(WebVitalName::Lcp) == (WEB_VITALS_LCP_GOOD_MS, WEB_VITALS_LCP_POOR_MS)
        && thresholds_for(WebVitalName::Inp) == (WEB_VITALS_INP_GOOD_MS, WEB_VITALS_INP_POOR_MS)
        && thresholds_for(WebVitalName::Ttfb)
            == (WEB_VITALS_TTFB_GOOD_MS, WEB_VITALS_TTFB_POOR_MS)
}

/// Dual-oracle residual: all metrics good strictly below poor.
#[must_use]
pub fn all_metrics_good_below_poor_shell() -> bool {
    good_strictly_below_poor()
        && WEB_VITALS_LCP_GOOD_MS < WEB_VITALS_LCP_POOR_MS
        && WEB_VITALS_INP_GOOD_MS < WEB_VITALS_INP_POOR_MS
        && WEB_VITALS_TTFB_GOOD_MS < WEB_VITALS_TTFB_POOR_MS
}

#[cfg(test)]
mod wave72_tests {
    use super::*;

    #[test]
    fn wave72_web_vitals_lcp_inp_ttfb_edges_dual_oracle() {
        assert!(lcp_rating_edge_shell());
        assert!(inp_rating_edge_shell());
        assert!(ttfb_rating_edge_shell());
        assert!(thresholds_pair_shell());
        assert!(all_metrics_good_below_poor_shell());
        assert!(fcp_rating_edge_shell());
        assert!(cls_rating_edge_shell());
        assert_eq!(rating_score_ladder(), [100, 50, 0]);
    }
}

// ── wave74 pure residual dens: web-vitals TTFB/INP score dual-oracle residual ──
// Dual-oracle residual of web-vitals thresholds pure halves.
// Browser PerformanceObserver residual retained. dens ≠ flip.

/// Dual-oracle residual: TTFB rating edges.
#[must_use]
pub fn wave74_ttfb_edges_shell() -> bool {
    get_rating(WebVitalName::Ttfb, 800.0) == MetricRating::Good
        && get_rating(WebVitalName::Ttfb, 801.0) == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Ttfb, 1_800.0) == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Ttfb, 1_801.0) == MetricRating::Poor
}

/// Dual-oracle residual: INP rating edges.
#[must_use]
pub fn wave74_inp_edges_shell() -> bool {
    get_rating(WebVitalName::Inp, 200.0) == MetricRating::Good
        && get_rating(WebVitalName::Inp, 201.0) == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Inp, 500.0) == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Inp, 501.0) == MetricRating::Poor
}

/// Dual-oracle residual: LCP good boundary inclusive.
#[must_use]
pub fn wave74_lcp_good_boundary_shell() -> bool {
    get_rating(WebVitalName::Lcp, 2_500.0) == MetricRating::Good
        && get_rating(WebVitalName::Lcp, 2_501.0) == MetricRating::NeedsImprovement
}

/// Dual-oracle residual: score points ladder.
#[must_use]
pub fn wave74_score_points_shell() -> bool {
    rating_score_points(MetricRating::Good) == 100
        && rating_score_points(MetricRating::NeedsImprovement) == 50
        && rating_score_points(MetricRating::Poor) == 0
}

/// Dual-oracle residual: CLS thresholds constants.
#[must_use]
pub fn wave74_cls_constants_shell() -> bool {
    WEB_VITALS_CLS_GOOD == 0.1
        && WEB_VITALS_CLS_POOR == 0.25
        && thresholds_for(WebVitalName::Cls) == (0.1, 0.25)
}

#[cfg(test)]
mod wave74_tests {
    use super::*;

    #[test]
    fn wave74_web_vitals_ttfb_inp_score_dual_oracle() {
        assert!(wave74_ttfb_edges_shell());
        assert!(wave74_inp_edges_shell());
        assert!(wave74_lcp_good_boundary_shell());
        assert!(wave74_score_points_shell());
        assert!(wave74_cls_constants_shell());
        assert_eq!(MetricRating::NeedsImprovement.as_str(), "needs-improvement");
    }
}

// ── wave75 pure residual dens: web-vitals FCP CLS rating dual-oracle residual ──
// Dual-oracle residual of web-vitals thresholds pure halves.
// Browser PerformanceObserver residual retained. dens ≠ flip.

/// Dual-oracle residual: FCP good/needs/poor edges.
#[must_use]
pub fn wave75_fcp_edges_shell() -> bool {
    get_rating(WebVitalName::Fcp, 1800.0) == MetricRating::Good
        && get_rating(WebVitalName::Fcp, 1800.1) == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Fcp, 3000.0) == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Fcp, 3000.1) == MetricRating::Poor
}

/// Dual-oracle residual: CLS unitless edges.
#[must_use]
pub fn wave75_cls_edges_shell() -> bool {
    get_rating(WebVitalName::Cls, 0.1) == MetricRating::Good
        && get_rating(WebVitalName::Cls, 0.11) == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Cls, 0.25) == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Cls, 0.26) == MetricRating::Poor
}

/// Dual-oracle residual: rating as_str catalog.
#[must_use]
pub fn wave75_rating_str_shell() -> bool {
    MetricRating::Good.as_str() == "good"
        && MetricRating::NeedsImprovement.as_str() == "needs-improvement"
        && MetricRating::Poor.as_str() == "poor"
}

/// Dual-oracle residual: score points + thresholds_for FCP.
#[must_use]
pub fn wave75_score_and_fcp_thresholds_shell() -> bool {
    rating_score_points(MetricRating::Good) == 100
        && rating_score_points(MetricRating::NeedsImprovement) == 50
        && rating_score_points(MetricRating::Poor) == 0
        && thresholds_for(WebVitalName::Fcp) == (WEB_VITALS_FCP_GOOD_MS, WEB_VITALS_FCP_POOR_MS)
}

/// Dual-oracle residual: LCP constants wire.
#[must_use]
pub fn wave75_lcp_constants_shell() -> bool {
    WEB_VITALS_LCP_GOOD_MS == 2_500.0 && WEB_VITALS_LCP_POOR_MS == 4_000.0
}

#[cfg(test)]
mod wave75_tests {
    use super::*;

    #[test]
    fn wave75_web_vitals_fcp_cls_rating_dual_oracle() {
        assert!(wave75_fcp_edges_shell());
        assert!(wave75_cls_edges_shell());
        assert!(wave75_rating_str_shell());
        assert!(wave75_score_and_fcp_thresholds_shell());
        assert!(wave75_lcp_constants_shell());
        assert!(wave74_score_points_shell());
    }
}


// ── wave76 pure residual dens: web-vitals INP TTFB needs score dual-oracle residual ──
// Dual-oracle residual of web-vitals thresholds pure halves.
// Browser PerformanceObserver residual retained. dens ≠ flip.

/// Dual-oracle residual: INP good/needs/poor edges.
#[must_use]
pub fn wave76_inp_edges_shell() -> bool {
    get_rating(WebVitalName::Inp, 200.0) == MetricRating::Good
        && get_rating(WebVitalName::Inp, 200.1) == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Inp, 500.0) == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Inp, 500.1) == MetricRating::Poor
}

/// Dual-oracle residual: TTFB constants + thresholds_for.
#[must_use]
pub fn wave76_ttfb_constants_shell() -> bool {
    WEB_VITALS_TTFB_GOOD_MS == 800.0
        && WEB_VITALS_TTFB_POOR_MS == 1_800.0
        && thresholds_for(WebVitalName::Ttfb) == (800.0, 1_800.0)
}

/// Dual-oracle residual: needs-improvement score 50.
#[must_use]
pub fn wave76_needs_score_shell() -> bool {
    rating_score_points(MetricRating::NeedsImprovement) == 50
        && MetricRating::NeedsImprovement.as_str() == "needs-improvement"
}

/// Dual-oracle residual: good strictly below poor for all metrics.
#[must_use]
pub fn wave76_good_below_poor_shell() -> bool {
    good_strictly_below_poor()
}

/// Dual-oracle residual: LCP edge ratings.
#[must_use]
pub fn wave76_lcp_edges_shell() -> bool {
    get_rating(WebVitalName::Lcp, 2500.0) == MetricRating::Good
        && get_rating(WebVitalName::Lcp, 2500.1) == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Lcp, 4000.0) == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Lcp, 4000.1) == MetricRating::Poor
}

#[cfg(test)]
mod wave76_tests {
    use super::*;

    #[test]
    fn wave76_web_vitals_inp_ttfb_needs_score_dual_oracle() {
        assert!(wave76_inp_edges_shell());
        assert!(wave76_ttfb_constants_shell());
        assert!(wave76_needs_score_shell());
        assert!(wave76_good_below_poor_shell());
        assert!(wave76_lcp_edges_shell());
        assert!(wave75_lcp_constants_shell());
    }
}


// ── wave77 pure residual dens: web-vitals FCP CLS rating score dual-oracle residual ──
// Dual-oracle residual of web-vitals thresholds pure halves.
// Browser PerformanceObserver residual retained. dens ≠ flip.

/// Dual-oracle residual: FCP good/poor boundary ratings.
#[must_use]
pub fn wave77_fcp_edges_shell() -> bool {
    get_rating(WebVitalName::Fcp, 1_800.0) == MetricRating::Good
        && get_rating(WebVitalName::Fcp, 1_801.0) == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Fcp, 3_000.0) == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Fcp, 3_001.0) == MetricRating::Poor
}

/// Dual-oracle residual: CLS edges at 0.1 / 0.25.
#[must_use]
pub fn wave77_cls_edges_shell() -> bool {
    get_rating(WebVitalName::Cls, 0.1) == MetricRating::Good
        && get_rating(WebVitalName::Cls, 0.11) == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Cls, 0.25) == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Cls, 0.26) == MetricRating::Poor
}

/// Dual-oracle residual: score points ladder + as_str.
#[must_use]
pub fn wave77_score_str_shell() -> bool {
    rating_score_points(MetricRating::Good) == 100
        && rating_score_points(MetricRating::NeedsImprovement) == 50
        && rating_score_points(MetricRating::Poor) == 0
        && MetricRating::Good.as_str() == "good"
}

/// Dual-oracle residual: thresholds_for pairs match constants.
#[must_use]
pub fn wave77_thresholds_pairs_shell() -> bool {
    thresholds_for(WebVitalName::Inp) == (WEB_VITALS_INP_GOOD_MS, WEB_VITALS_INP_POOR_MS)
        && thresholds_for(WebVitalName::Ttfb) == (WEB_VITALS_TTFB_GOOD_MS, WEB_VITALS_TTFB_POOR_MS)
        && WEB_VITALS_INP_GOOD_MS == 200.0
        && WEB_VITALS_TTFB_GOOD_MS == 800.0
}

/// Dual-oracle residual: all metrics good strictly below poor.
#[must_use]
pub fn wave77_good_below_poor_shell() -> bool {
    good_strictly_below_poor()
}

#[cfg(test)]
mod wave77_tests {
    use super::*;

    #[test]
    fn wave77_web_vitals_fcp_cls_rating_score_dual_oracle() {
        assert!(wave77_fcp_edges_shell());
        assert!(wave77_cls_edges_shell());
        assert!(wave77_score_str_shell());
        assert!(wave77_thresholds_pairs_shell());
        assert!(wave77_good_below_poor_shell());
        assert!(wave76_needs_score_shell());
    }
}


// ── wave78 pure residual dens: web-vitals INP TTFB LCP poor score dual-oracle residual ──
// Dual-oracle residual of web-vitals thresholds pure halves.
// Browser PerformanceObserver residual retained. dens ≠ flip.

/// Dual-oracle residual: INP good/poor boundary ratings.
#[must_use]
pub fn wave78_inp_edges_shell() -> bool {
    get_rating(WebVitalName::Inp, 200.0) == MetricRating::Good
        && get_rating(WebVitalName::Inp, 200.1) == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Inp, 500.0) == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Inp, 500.1) == MetricRating::Poor
}

/// Dual-oracle residual: TTFB edges at 800 / 1800.
#[must_use]
pub fn wave78_ttfb_edges_shell() -> bool {
    get_rating(WebVitalName::Ttfb, 800.0) == MetricRating::Good
        && get_rating(WebVitalName::Ttfb, 800.1) == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Ttfb, 1_800.0) == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Ttfb, 1_800.1) == MetricRating::Poor
}

/// Dual-oracle residual: poor score 0 + as_str.
#[must_use]
pub fn wave78_poor_score_shell() -> bool {
    rating_score_points(MetricRating::Poor) == 0
        && MetricRating::Poor.as_str() == "poor"
        && rating_score_points(MetricRating::Good) == 100
}

/// Dual-oracle residual: LCP constants pair.
#[must_use]
pub fn wave78_lcp_const_shell() -> bool {
    thresholds_for(WebVitalName::Lcp) == (WEB_VITALS_LCP_GOOD_MS, WEB_VITALS_LCP_POOR_MS)
        && WEB_VITALS_LCP_GOOD_MS == 2_500.0
        && WEB_VITALS_LCP_POOR_MS == 4_000.0
}

/// Dual-oracle residual: FCP constants + good below poor all.
#[must_use]
pub fn wave78_fcp_good_below_shell() -> bool {
    WEB_VITALS_FCP_GOOD_MS == 1_800.0
        && WEB_VITALS_FCP_POOR_MS == 3_000.0
        && good_strictly_below_poor()
}

#[cfg(test)]
mod wave78_tests {
    use super::*;

    #[test]
    fn wave78_web_vitals_inp_ttfb_lcp_poor_score_dual_oracle() {
        assert!(wave78_inp_edges_shell());
        assert!(wave78_ttfb_edges_shell());
        assert!(wave78_poor_score_shell());
        assert!(wave78_lcp_const_shell());
        assert!(wave78_fcp_good_below_shell());
        assert!(wave77_score_str_shell());
    }
}


// ── wave79 pure residual dens: web-vitals CLS FCP LCP needs dual-oracle residual ──
// Dual-oracle residual of web-vitals thresholds pure halves.
// Browser PerformanceObserver residual retained. dens ≠ flip.

/// Dual-oracle residual: CLS edges at 0.1 / 0.25.
#[must_use]
pub fn wave79_cls_edges_shell() -> bool {
    get_rating(WebVitalName::Cls, 0.1) == MetricRating::Good
        && get_rating(WebVitalName::Cls, 0.1001) == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Cls, 0.25) == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Cls, 0.2501) == MetricRating::Poor
}

/// Dual-oracle residual: FCP edges at 1800 / 3000.
#[must_use]
pub fn wave79_fcp_edges_shell() -> bool {
    get_rating(WebVitalName::Fcp, 1_800.0) == MetricRating::Good
        && get_rating(WebVitalName::Fcp, 1_800.1) == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Fcp, 3_000.0) == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Fcp, 3_000.1) == MetricRating::Poor
}

/// Dual-oracle residual: LCP edges at 2500 / 4000.
#[must_use]
pub fn wave79_lcp_edges_shell() -> bool {
    get_rating(WebVitalName::Lcp, 2_500.0) == MetricRating::Good
        && get_rating(WebVitalName::Lcp, 2_500.1) == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Lcp, 4_000.0) == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Lcp, 4_000.1) == MetricRating::Poor
}

/// Dual-oracle residual: needs-improvement score 50 + wire string.
#[must_use]
pub fn wave79_needs_score_shell() -> bool {
    rating_score_points(MetricRating::NeedsImprovement) == 50
        && MetricRating::NeedsImprovement.as_str() == "needs-improvement"
        && rating_score_points(MetricRating::Good) == 100
}

/// Dual-oracle residual: CLS constants + good below poor invariant.
#[must_use]
pub fn wave79_cls_const_shell() -> bool {
    thresholds_for(WebVitalName::Cls) == (WEB_VITALS_CLS_GOOD, WEB_VITALS_CLS_POOR)
        && WEB_VITALS_CLS_GOOD == 0.1
        && WEB_VITALS_CLS_POOR == 0.25
        && good_strictly_below_poor()
}

#[cfg(test)]
mod wave79_tests {
    use super::*;

    #[test]
    fn wave79_web_vitals_cls_fcp_lcp_needs_dual_oracle() {
        assert!(wave79_cls_edges_shell());
        assert!(wave79_fcp_edges_shell());
        assert!(wave79_lcp_edges_shell());
        assert!(wave79_needs_score_shell());
        assert!(wave79_cls_const_shell());
        assert!(wave78_poor_score_shell());
    }
}


// ── wave80 pure residual dens: web-vitals INP TTFB score dual-oracle residual ──
// Dual-oracle residual of web-vitals thresholds pure halves.
// Browser PerformanceObserver residual retained. dens ≠ flip.

/// Dual-oracle residual: INP good/needs/poor edges.
#[must_use]
pub fn wave80_inp_edges_shell() -> bool {
    get_rating(WebVitalName::Inp, 200.0) == MetricRating::Good
        && get_rating(WebVitalName::Inp, 201.0) == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Inp, 500.0) == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Inp, 501.0) == MetricRating::Poor
}

/// Dual-oracle residual: TTFB good/needs/poor edges.
#[must_use]
pub fn wave80_ttfb_edges_shell() -> bool {
    get_rating(WebVitalName::Ttfb, 800.0) == MetricRating::Good
        && get_rating(WebVitalName::Ttfb, 801.0) == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Ttfb, 1_800.0) == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Ttfb, 1_801.0) == MetricRating::Poor
}

/// Dual-oracle residual: score points 100/50/0.
#[must_use]
pub fn wave80_score_shell() -> bool {
    rating_score_points(MetricRating::Good) == 100
        && rating_score_points(MetricRating::NeedsImprovement) == 50
        && rating_score_points(MetricRating::Poor) == 0
        && MetricRating::NeedsImprovement.as_str() == "needs-improvement"
}

/// Dual-oracle residual: threshold pairs for INP/TTFB.
#[must_use]
pub fn wave80_threshold_pairs_shell() -> bool {
    thresholds_for(WebVitalName::Inp) == (WEB_VITALS_INP_GOOD_MS, WEB_VITALS_INP_POOR_MS)
        && thresholds_for(WebVitalName::Ttfb) == (WEB_VITALS_TTFB_GOOD_MS, WEB_VITALS_TTFB_POOR_MS)
        && WEB_VITALS_INP_GOOD_MS == 200.0
        && WEB_VITALS_TTFB_POOR_MS == 1_800.0
}

/// Dual-oracle residual: CLS/FCP good-below-poor invariant.
#[must_use]
pub fn wave80_good_below_poor_shell() -> bool {
    WEB_VITALS_CLS_GOOD < WEB_VITALS_CLS_POOR
        && WEB_VITALS_FCP_GOOD_MS < WEB_VITALS_FCP_POOR_MS
        && WEB_VITALS_LCP_GOOD_MS < WEB_VITALS_LCP_POOR_MS
}

#[cfg(test)]
mod wave80_tests {
    use super::*;

    #[test]
    fn wave80_web_vitals_inp_ttfb_score_dual_oracle() {
        assert!(wave80_inp_edges_shell());
        assert!(wave80_ttfb_edges_shell());
        assert!(wave80_score_shell());
        assert!(wave80_threshold_pairs_shell());
        assert!(wave80_good_below_poor_shell());
        assert!(wave79_cls_const_shell());
    }
}


// ── wave81 pure residual dens: web-vitals LCP FCP CLS rating wire dual-oracle residual ──
// Dual-oracle residual of web-vitals thresholds pure halves.
// Browser PerformanceObserver residual retained. dens ≠ flip.

/// Dual-oracle residual: LCP good/needs/poor edges.
#[must_use]
pub fn wave81_lcp_edges_shell() -> bool {
    get_rating(WebVitalName::Lcp, 2_500.0) == MetricRating::Good
        && get_rating(WebVitalName::Lcp, 2_500.1) == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Lcp, 4_000.0) == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Lcp, 4_000.1) == MetricRating::Poor
}

/// Dual-oracle residual: FCP good/needs/poor edges.
#[must_use]
pub fn wave81_fcp_edges_shell() -> bool {
    get_rating(WebVitalName::Fcp, 1_800.0) == MetricRating::Good
        && get_rating(WebVitalName::Fcp, 1_800.1) == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Fcp, 3_000.0) == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Fcp, 3_000.1) == MetricRating::Poor
}

/// Dual-oracle residual: CLS edges + constants.
#[must_use]
pub fn wave81_cls_edges_shell() -> bool {
    get_rating(WebVitalName::Cls, 0.1) == MetricRating::Good
        && get_rating(WebVitalName::Cls, 0.11) == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Cls, 0.25) == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Cls, 0.26) == MetricRating::Poor
        && WEB_VITALS_CLS_GOOD == 0.1
        && WEB_VITALS_CLS_POOR == 0.25
}

/// Dual-oracle residual: rating wire strings + score ladder.
#[must_use]
pub fn wave81_rating_wire_shell() -> bool {
    MetricRating::Good.as_str() == "good"
        && MetricRating::NeedsImprovement.as_str() == "needs-improvement"
        && MetricRating::Poor.as_str() == "poor"
        && rating_score_points(MetricRating::Good) == 100
        && rating_score_points(MetricRating::NeedsImprovement) == 50
        && rating_score_points(MetricRating::Poor) == 0
}

/// Dual-oracle residual: LCP/FCP threshold pairs + good-below-poor.
#[must_use]
pub fn wave81_threshold_pairs_shell() -> bool {
    thresholds_for(WebVitalName::Lcp) == (WEB_VITALS_LCP_GOOD_MS, WEB_VITALS_LCP_POOR_MS)
        && thresholds_for(WebVitalName::Fcp) == (WEB_VITALS_FCP_GOOD_MS, WEB_VITALS_FCP_POOR_MS)
        && WEB_VITALS_LCP_GOOD_MS == 2_500.0
        && WEB_VITALS_FCP_POOR_MS == 3_000.0
        && good_strictly_below_poor()
}

#[cfg(test)]
mod wave81_tests {
    use super::*;

    #[test]
    fn wave81_web_vitals_lcp_fcp_cls_rating_wire_dual_oracle() {
        assert!(wave81_lcp_edges_shell());
        assert!(wave81_fcp_edges_shell());
        assert!(wave81_cls_edges_shell());
        assert!(wave81_rating_wire_shell());
        assert!(wave81_threshold_pairs_shell());
        assert!(wave80_score_shell());
    }
}


// ── wave83 pure residual dens: web-vitals INP TTFB score as_str dual-oracle residual ──
// Dual-oracle residual of web-vitals thresholds pure halves.
// Browser PerformanceObserver residual retained. dens ≠ flip.

/// Dual-oracle residual: INP good/needs/poor edges.
#[must_use]
pub fn wave83_inp_edges_shell() -> bool {
    get_rating(WebVitalName::Inp, 200.0) == MetricRating::Good
        && get_rating(WebVitalName::Inp, 200.1) == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Inp, 500.0) == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Inp, 500.1) == MetricRating::Poor
}

/// Dual-oracle residual: TTFB edges + constants.
#[must_use]
pub fn wave83_ttfb_edges_shell() -> bool {
    get_rating(WebVitalName::Ttfb, 800.0) == MetricRating::Good
        && get_rating(WebVitalName::Ttfb, 800.1) == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Ttfb, 1_800.0) == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Ttfb, 1_800.1) == MetricRating::Poor
        && WEB_VITALS_TTFB_GOOD_MS == 800.0
        && WEB_VITALS_TTFB_POOR_MS == 1_800.0
}

/// Dual-oracle residual: score points + as_str.
#[must_use]
pub fn wave83_score_as_str_shell() -> bool {
    rating_score_points(MetricRating::Good) == 100
        && rating_score_points(MetricRating::NeedsImprovement) == 50
        && rating_score_points(MetricRating::Poor) == 0
        && MetricRating::Good.as_str() == "good"
        && MetricRating::NeedsImprovement.as_str() == "needs-improvement"
        && MetricRating::Poor.as_str() == "poor"
}

/// Dual-oracle residual: INP/TTFB threshold pairs.
#[must_use]
pub fn wave83_threshold_pairs_shell() -> bool {
    thresholds_for(WebVitalName::Inp) == (WEB_VITALS_INP_GOOD_MS, WEB_VITALS_INP_POOR_MS)
        && thresholds_for(WebVitalName::Ttfb) == (WEB_VITALS_TTFB_GOOD_MS, WEB_VITALS_TTFB_POOR_MS)
        && WEB_VITALS_INP_GOOD_MS == 200.0
        && WEB_VITALS_INP_POOR_MS == 500.0
}

/// Dual-oracle residual: good strictly below poor for all metrics.
#[must_use]
pub fn wave83_good_below_poor_shell() -> bool {
    good_strictly_below_poor()
}

#[cfg(test)]
mod wave83_tests {
    use super::*;

    #[test]
    fn wave83_web_vitals_inp_ttfb_score_as_str_dual_oracle() {
        assert!(wave83_inp_edges_shell());
        assert!(wave83_ttfb_edges_shell());
        assert!(wave83_score_as_str_shell());
        assert!(wave83_threshold_pairs_shell());
        assert!(wave83_good_below_poor_shell());
        assert!(wave81_rating_wire_shell());
    }
}

// ── wave84 pure residual dens: web-vitals LCP CLS FCP edges score dual-oracle residual ──
// Dual-oracle residual of web-vitals thresholds pure halves.
// Browser PerformanceObserver residual retained. dens ≠ flip.

/// Dual-oracle residual: LCP good/needs/poor edges.
#[must_use]
pub fn wave84_lcp_edges_shell() -> bool {
    get_rating(WebVitalName::Lcp, 2_500.0) == MetricRating::Good
        && get_rating(WebVitalName::Lcp, 2_500.1) == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Lcp, 4_000.0) == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Lcp, 4_000.1) == MetricRating::Poor
}

/// Dual-oracle residual: CLS edges dual-oracle.
#[must_use]
pub fn wave84_cls_edges_shell() -> bool {
    get_rating(WebVitalName::Cls, 0.1) == MetricRating::Good
        && get_rating(WebVitalName::Cls, 0.1001) == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Cls, 0.25) == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Cls, 0.2501) == MetricRating::Poor
}

/// Dual-oracle residual: FCP threshold pair + edges.
#[must_use]
pub fn wave84_fcp_shell() -> bool {
    thresholds_for(WebVitalName::Fcp) == (WEB_VITALS_FCP_GOOD_MS, WEB_VITALS_FCP_POOR_MS)
        && get_rating(WebVitalName::Fcp, WEB_VITALS_FCP_GOOD_MS) == MetricRating::Good
        && get_rating(WebVitalName::Fcp, WEB_VITALS_FCP_POOR_MS + 0.1) == MetricRating::Poor
}

/// Dual-oracle residual: score points + as_str dual-oracle.
#[must_use]
pub fn wave84_score_shell() -> bool {
    rating_score_points(MetricRating::Good) == 100
        && rating_score_points(MetricRating::NeedsImprovement) == 50
        && rating_score_points(MetricRating::Poor) == 0
        && MetricRating::Good.as_str() == "good"
        && MetricRating::Poor.as_str() == "poor"
}

/// Dual-oracle residual: good strictly below poor closed.
#[must_use]
pub fn wave84_good_below_poor_shell() -> bool {
    good_strictly_below_poor()
        && WEB_VITALS_LCP_GOOD_MS < WEB_VITALS_LCP_POOR_MS
        && WEB_VITALS_CLS_GOOD < WEB_VITALS_CLS_POOR
}

#[cfg(test)]
mod wave84_tests {
    use super::*;

    #[test]
    fn wave84_web_vitals_lcp_cls_fcp_edges_score_dual_oracle() {
        assert!(wave84_lcp_edges_shell());
        assert!(wave84_cls_edges_shell());
        assert!(wave84_fcp_shell());
        assert!(wave84_score_shell());
        assert!(wave84_good_below_poor_shell());
        assert!(wave83_good_below_poor_shell());
    }
}

// ── wave85 pure residual dens: web-vitals INP TTFB rating score dual-oracle residual ──
// Dual-oracle residual of web-vitals thresholds pure halves.
// Browser PerformanceObserver residual retained. dens ≠ flip.

/// Dual-oracle residual: INP edges good/needs/poor.
#[must_use]
pub fn wave85_inp_edges_shell() -> bool {
    get_rating(WebVitalName::Inp, WEB_VITALS_INP_GOOD_MS) == MetricRating::Good
        && get_rating(WebVitalName::Inp, WEB_VITALS_INP_GOOD_MS + 1.0)
            == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Inp, WEB_VITALS_INP_POOR_MS + 1.0) == MetricRating::Poor
        && WEB_VITALS_INP_GOOD_MS == 200.0
        && WEB_VITALS_INP_POOR_MS == 500.0
}

/// Dual-oracle residual: TTFB threshold pair + rating mid.
#[must_use]
pub fn wave85_ttfb_pair_shell() -> bool {
    thresholds_for(WebVitalName::Ttfb) == (WEB_VITALS_TTFB_GOOD_MS, WEB_VITALS_TTFB_POOR_MS)
        && WEB_VITALS_TTFB_GOOD_MS == 800.0
        && WEB_VITALS_TTFB_POOR_MS == 1_800.0
        && get_rating(WebVitalName::Ttfb, 1_000.0) == MetricRating::NeedsImprovement
}

/// Dual-oracle residual: rating score points ladder.
#[must_use]
pub fn wave85_score_ladder_shell() -> bool {
    rating_score_points(MetricRating::Good) == 100
        && rating_score_points(MetricRating::NeedsImprovement) == 50
        && rating_score_points(MetricRating::Poor) == 0
        && MetricRating::NeedsImprovement.as_str() == "needs-improvement"
}

/// Dual-oracle residual: LCP poor boundary + as_str good.
#[must_use]
pub fn wave85_lcp_as_str_shell() -> bool {
    get_rating(WebVitalName::Lcp, WEB_VITALS_LCP_POOR_MS) == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Lcp, WEB_VITALS_LCP_POOR_MS + 0.1) == MetricRating::Poor
        && MetricRating::Good.as_str() == "good"
        && MetricRating::Poor.as_str() == "poor"
}

/// Dual-oracle residual: CLS unitless edges dual-oracle.
#[must_use]
pub fn wave85_cls_edges_shell() -> bool {
    get_rating(WebVitalName::Cls, WEB_VITALS_CLS_GOOD) == MetricRating::Good
        && get_rating(WebVitalName::Cls, 0.15) == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Cls, WEB_VITALS_CLS_POOR + 0.01) == MetricRating::Poor
        && WEB_VITALS_CLS_GOOD == 0.1
        && WEB_VITALS_CLS_POOR == 0.25
}

#[cfg(test)]
mod wave85_tests {
    use super::*;

    #[test]
    fn wave85_web_vitals_inp_ttfb_rating_score_dual_oracle() {
        assert!(wave85_inp_edges_shell());
        assert!(wave85_ttfb_pair_shell());
        assert!(wave85_score_ladder_shell());
        assert!(wave85_lcp_as_str_shell());
        assert!(wave85_cls_edges_shell());
        assert!(wave84_good_below_poor_shell());
    }
}
// ── wave86 pure residual dens: web-vitals FCP LCP score as_str dual-oracle residual ──
// Dual-oracle residual of web-vitals thresholds pure halves.
// Browser PerformanceObserver residual retained. dens ≠ flip.

/// Dual-oracle residual: FCP good/poor edges inclusive.
#[must_use]
pub fn wave86_fcp_edges_shell() -> bool {
    get_rating(WebVitalName::Fcp, WEB_VITALS_FCP_GOOD_MS) == MetricRating::Good
        && get_rating(WebVitalName::Fcp, WEB_VITALS_FCP_GOOD_MS + 1.0)
            == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Fcp, WEB_VITALS_FCP_POOR_MS)
            == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Fcp, WEB_VITALS_FCP_POOR_MS + 1.0) == MetricRating::Poor
        && WEB_VITALS_FCP_GOOD_MS == 1_800.0
}

/// Dual-oracle residual: LCP thresholds pair + ratings.
#[must_use]
pub fn wave86_lcp_pair_shell() -> bool {
    thresholds_for(WebVitalName::Lcp) == (WEB_VITALS_LCP_GOOD_MS, WEB_VITALS_LCP_POOR_MS)
        && get_rating(WebVitalName::Lcp, WEB_VITALS_LCP_GOOD_MS) == MetricRating::Good
        && get_rating(WebVitalName::Lcp, WEB_VITALS_LCP_POOR_MS + 1.0) == MetricRating::Poor
        && WEB_VITALS_LCP_GOOD_MS == 2_500.0
        && WEB_VITALS_LCP_POOR_MS == 4_000.0
}

/// Dual-oracle residual: score ladder 100/50/0.
#[must_use]
pub fn wave86_score_ladder_shell() -> bool {
    rating_score_points(MetricRating::Good) == 100
        && rating_score_points(MetricRating::NeedsImprovement) == 50
        && rating_score_points(MetricRating::Poor) == 0
        && rating_score_ladder() == [100, 50, 0]
}

/// Dual-oracle residual: MetricRating as_str wire labels.
#[must_use]
pub fn wave86_rating_as_str_shell() -> bool {
    MetricRating::Good.as_str() == "good"
        && MetricRating::NeedsImprovement.as_str() == "needs-improvement"
        && MetricRating::Poor.as_str() == "poor"
}

/// Dual-oracle residual: good strictly below poor for all metrics.
#[must_use]
pub fn wave86_good_below_poor_shell() -> bool {
    let pairs = [
        thresholds_for(WebVitalName::Lcp),
        thresholds_for(WebVitalName::Inp),
        thresholds_for(WebVitalName::Cls),
        thresholds_for(WebVitalName::Fcp),
        thresholds_for(WebVitalName::Ttfb),
    ];
    pairs.iter().all(|(g, p)| *g < *p)
}

#[cfg(test)]
mod wave86_tests {
    use super::*;

    #[test]
    fn wave86_web_vitals_fcp_lcp_score_as_str_dual_oracle() {
        assert!(wave86_fcp_edges_shell());
        assert!(wave86_lcp_pair_shell());
        assert!(wave86_score_ladder_shell());
        assert!(wave86_rating_as_str_shell());
        assert!(wave86_good_below_poor_shell());
        assert!(wave85_score_ladder_shell());
    }
}

// ── wave87 pure residual dens: web-vitals FCP LCP CLS score dual-oracle residual ──
// Dual-oracle residual of web-vitals thresholds pure halves.
// Browser PerformanceObserver residual retained. dens ≠ flip.

/// Dual-oracle residual: FCP edges good/needs/poor.
#[must_use]
pub fn wave87_fcp_edges_shell() -> bool {
    get_rating(WebVitalName::Fcp, WEB_VITALS_FCP_GOOD_MS) == MetricRating::Good
        && get_rating(WebVitalName::Fcp, WEB_VITALS_FCP_GOOD_MS + 1.0)
            == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Fcp, WEB_VITALS_FCP_POOR_MS + 1.0) == MetricRating::Poor
        && thresholds_for(WebVitalName::Fcp)
            == (WEB_VITALS_FCP_GOOD_MS, WEB_VITALS_FCP_POOR_MS)
}

/// Dual-oracle residual: LCP mid needs-improvement + as_str.
#[must_use]
pub fn wave87_lcp_mid_shell() -> bool {
    get_rating(WebVitalName::Lcp, 3000.0) == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Lcp, WEB_VITALS_LCP_GOOD_MS) == MetricRating::Good
        && get_rating(WebVitalName::Lcp, WEB_VITALS_LCP_POOR_MS + 1.0) == MetricRating::Poor
        && MetricRating::NeedsImprovement.as_str() == "needs-improvement"
}

/// Dual-oracle residual: CLS edges + good strict below poor.
#[must_use]
pub fn wave87_cls_edges_shell() -> bool {
    get_rating(WebVitalName::Cls, 0.05) == MetricRating::Good
        && get_rating(WebVitalName::Cls, 0.2) == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Cls, 0.5) == MetricRating::Poor
        && WEB_VITALS_CLS_GOOD < WEB_VITALS_CLS_POOR
}

/// Dual-oracle residual: score ladder + poor zero.
#[must_use]
pub fn wave87_score_ladder_shell() -> bool {
    rating_score_points(MetricRating::Good) == 100
        && rating_score_points(MetricRating::NeedsImprovement) == 50
        && rating_score_points(MetricRating::Poor) == 0
        && MetricRating::Good.as_str() == "good"
        && MetricRating::Poor.as_str() == "poor"
}

/// Dual-oracle residual: INP/TTFB pairs good below poor.
#[must_use]
pub fn wave87_inp_ttfb_pairs_shell() -> bool {
    let (ig, ip) = thresholds_for(WebVitalName::Inp);
    let (tg, tp) = thresholds_for(WebVitalName::Ttfb);
    ig == WEB_VITALS_INP_GOOD_MS
        && ip == WEB_VITALS_INP_POOR_MS
        && tg == WEB_VITALS_TTFB_GOOD_MS
        && tp == WEB_VITALS_TTFB_POOR_MS
        && ig < ip
        && tg < tp
}

#[cfg(test)]
mod wave87_tests {
    use super::*;

    #[test]
    fn wave87_web_vitals_fcp_lcp_cls_score_dual_oracle() {
        assert!(wave87_fcp_edges_shell());
        assert!(wave87_lcp_mid_shell());
        assert!(wave87_cls_edges_shell());
        assert!(wave87_score_ladder_shell());
        assert!(wave87_inp_ttfb_pairs_shell());
        assert!(wave85_cls_edges_shell());
    }
}

// ── wave88 pure residual dens: web-vitals INP TTFB FCP score dual-oracle residual ──
// Dual-oracle residual of web-vitals thresholds pure halves.
// Browser PerformanceObserver residual retained. dens ≠ flip.

/// Dual-oracle residual: INP good/needs/poor edges.
#[must_use]
pub fn wave88_inp_edges_shell() -> bool {
    get_rating(WebVitalName::Inp, WEB_VITALS_INP_GOOD_MS) == MetricRating::Good
        && get_rating(WebVitalName::Inp, WEB_VITALS_INP_GOOD_MS + 1.0)
            == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Inp, WEB_VITALS_INP_POOR_MS + 1.0) == MetricRating::Poor
        && thresholds_for(WebVitalName::Inp)
            == (WEB_VITALS_INP_GOOD_MS, WEB_VITALS_INP_POOR_MS)
}

/// Dual-oracle residual: TTFB mid needs + constants.
#[must_use]
pub fn wave88_ttfb_mid_shell() -> bool {
    get_rating(WebVitalName::Ttfb, 1_000.0) == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Ttfb, WEB_VITALS_TTFB_GOOD_MS) == MetricRating::Good
        && get_rating(WebVitalName::Ttfb, WEB_VITALS_TTFB_POOR_MS + 1.0) == MetricRating::Poor
        && WEB_VITALS_TTFB_GOOD_MS < WEB_VITALS_TTFB_POOR_MS
}

/// Dual-oracle residual: FCP constants + good boundary.
#[must_use]
pub fn wave88_fcp_const_shell() -> bool {
    WEB_VITALS_FCP_GOOD_MS == 1_800.0
        && WEB_VITALS_FCP_POOR_MS == 3_000.0
        && get_rating(WebVitalName::Fcp, 1_800.0) == MetricRating::Good
        && get_rating(WebVitalName::Fcp, 1_801.0) == MetricRating::NeedsImprovement
}

/// Dual-oracle residual: score ladder + as_str wire.
#[must_use]
pub fn wave88_score_wire_shell() -> bool {
    rating_score_points(MetricRating::Good) == 100
        && rating_score_points(MetricRating::NeedsImprovement) == 50
        && rating_score_points(MetricRating::Poor) == 0
        && MetricRating::Good.as_str() == "good"
        && MetricRating::NeedsImprovement.as_str() == "needs-improvement"
}

/// Dual-oracle residual: LCP poor edge + CLS good below poor.
#[must_use]
pub fn wave88_lcp_cls_shell() -> bool {
    get_rating(WebVitalName::Lcp, WEB_VITALS_LCP_POOR_MS + 1.0) == MetricRating::Poor
        && get_rating(WebVitalName::Cls, WEB_VITALS_CLS_GOOD) == MetricRating::Good
        && get_rating(WebVitalName::Cls, WEB_VITALS_CLS_POOR + 0.01) == MetricRating::Poor
        && WEB_VITALS_CLS_GOOD < WEB_VITALS_CLS_POOR
}

#[cfg(test)]
mod wave88_tests {
    use super::*;

    #[test]
    fn wave88_web_vitals_inp_ttfb_fcp_score_dual_oracle() {
        assert!(wave88_inp_edges_shell());
        assert!(wave88_ttfb_mid_shell());
        assert!(wave88_fcp_const_shell());
        assert!(wave88_score_wire_shell());
        assert!(wave88_lcp_cls_shell());
        assert!(wave87_score_ladder_shell());
    }
}

// ── wave89 pure residual dens: web-vitals LCP CLS INP score dual-oracle residual ──
// Dual-oracle residual of web-vitals thresholds pure halves.
// Browser PerformanceObserver residual retained. dens ≠ flip.

/// Dual-oracle residual: LCP good/needs/poor edges.
#[must_use]
pub fn wave89_lcp_edges_shell() -> bool {
    get_rating(WebVitalName::Lcp, WEB_VITALS_LCP_GOOD_MS) == MetricRating::Good
        && get_rating(WebVitalName::Lcp, WEB_VITALS_LCP_GOOD_MS + 1.0)
            == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Lcp, WEB_VITALS_LCP_POOR_MS + 1.0) == MetricRating::Poor
        && thresholds_for(WebVitalName::Lcp)
            == (WEB_VITALS_LCP_GOOD_MS, WEB_VITALS_LCP_POOR_MS)
}

/// Dual-oracle residual: CLS mid needs + constants.
#[must_use]
pub fn wave89_cls_mid_shell() -> bool {
    get_rating(WebVitalName::Cls, 0.15) == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Cls, WEB_VITALS_CLS_GOOD) == MetricRating::Good
        && get_rating(WebVitalName::Cls, WEB_VITALS_CLS_POOR + 0.001) == MetricRating::Poor
        && WEB_VITALS_CLS_GOOD == 0.1
        && WEB_VITALS_CLS_POOR == 0.25
}

/// Dual-oracle residual: INP good boundary + poor const.
#[must_use]
pub fn wave89_inp_const_shell() -> bool {
    WEB_VITALS_INP_GOOD_MS == 200.0
        && WEB_VITALS_INP_POOR_MS == 500.0
        && get_rating(WebVitalName::Inp, 200.0) == MetricRating::Good
        && get_rating(WebVitalName::Inp, 501.0) == MetricRating::Poor
}

/// Dual-oracle residual: score poor zero + as_str poor.
#[must_use]
pub fn wave89_score_poor_shell() -> bool {
    rating_score_points(MetricRating::Poor) == 0
        && rating_score_points(MetricRating::Good) == 100
        && MetricRating::Poor.as_str() == "poor"
        && MetricRating::NeedsImprovement.as_str() == "needs-improvement"
}

/// Dual-oracle residual: TTFB/FCP constants dual-oracle.
#[must_use]
pub fn wave89_ttfb_fcp_const_shell() -> bool {
    WEB_VITALS_TTFB_GOOD_MS == 800.0
        && WEB_VITALS_TTFB_POOR_MS == 1_800.0
        && WEB_VITALS_FCP_GOOD_MS == 1_800.0
        && WEB_VITALS_LCP_GOOD_MS == 2_500.0
        && get_rating(WebVitalName::Ttfb, 800.0) == MetricRating::Good
}

#[cfg(test)]
mod wave89_tests {
    use super::*;

    #[test]
    fn wave89_web_vitals_lcp_cls_inp_score_dual_oracle() {
        assert!(wave89_lcp_edges_shell());
        assert!(wave89_cls_mid_shell());
        assert!(wave89_inp_const_shell());
        assert!(wave89_score_poor_shell());
        assert!(wave89_ttfb_fcp_const_shell());
        assert!(wave88_score_wire_shell());
    }
}

// ── wave90 pure residual dens: web-vitals INP TTFB FCP score edges dual-oracle residual ──
// Dual-oracle residual of web-vitals thresholds pure halves.
// Browser PerformanceObserver residual retained. dens ≠ flip.

/// Dual-oracle residual: INP mid needs + edges.
#[must_use]
pub fn wave90_inp_mid_shell() -> bool {
    get_rating(WebVitalName::Inp, 350.0) == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Inp, WEB_VITALS_INP_GOOD_MS) == MetricRating::Good
        && get_rating(WebVitalName::Inp, WEB_VITALS_INP_POOR_MS + 1.0) == MetricRating::Poor
        && thresholds_for(WebVitalName::Inp)
            == (WEB_VITALS_INP_GOOD_MS, WEB_VITALS_INP_POOR_MS)
}

/// Dual-oracle residual: TTFB edges good/poor.
#[must_use]
pub fn wave90_ttfb_edges_shell() -> bool {
    get_rating(WebVitalName::Ttfb, WEB_VITALS_TTFB_GOOD_MS) == MetricRating::Good
        && get_rating(WebVitalName::Ttfb, WEB_VITALS_TTFB_GOOD_MS + 1.0)
            == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Ttfb, WEB_VITALS_TTFB_POOR_MS + 1.0) == MetricRating::Poor
        && WEB_VITALS_TTFB_GOOD_MS == 800.0
}

/// Dual-oracle residual: FCP poor edge + constants.
#[must_use]
pub fn wave90_fcp_poor_shell() -> bool {
    get_rating(WebVitalName::Fcp, WEB_VITALS_FCP_POOR_MS + 1.0) == MetricRating::Poor
        && get_rating(WebVitalName::Fcp, WEB_VITALS_FCP_GOOD_MS) == MetricRating::Good
        && WEB_VITALS_FCP_GOOD_MS == 1_800.0
        && WEB_VITALS_FCP_POOR_MS == 3_000.0
}

/// Dual-oracle residual: score good 100 + as_str wire.
#[must_use]
pub fn wave90_score_good_shell() -> bool {
    rating_score_points(MetricRating::Good) == 100
        && rating_score_points(MetricRating::NeedsImprovement) == 50
        && rating_score_points(MetricRating::Poor) == 0
        && MetricRating::Good.as_str() == "good"
}

/// Dual-oracle residual: LCP/CLS dual constants + ratings.
#[must_use]
pub fn wave90_lcp_cls_dual_shell() -> bool {
    WEB_VITALS_LCP_GOOD_MS == 2_500.0
        && WEB_VITALS_LCP_POOR_MS == 4_000.0
        && WEB_VITALS_CLS_GOOD == 0.1
        && get_rating(WebVitalName::Lcp, 2_500.0) == MetricRating::Good
        && get_rating(WebVitalName::Cls, 0.1) == MetricRating::Good
}

#[cfg(test)]
mod wave90_tests {
    use super::*;

    #[test]
    fn wave90_web_vitals_inp_ttfb_fcp_score_edges_dual_oracle() {
        assert!(wave90_inp_mid_shell());
        assert!(wave90_ttfb_edges_shell());
        assert!(wave90_fcp_poor_shell());
        assert!(wave90_score_good_shell());
        assert!(wave90_lcp_cls_dual_shell());
        assert!(wave89_score_poor_shell());
    }
}

// ── wave91 pure residual dens: web-vitals CLS LCP score wire INP dual-oracle residual ──
// Dual-oracle residual of web-vitals thresholds pure halves.
// Browser PerformanceObserver residual retained. dens ≠ flip.

/// Dual-oracle residual: CLS mid needs + edges.
#[must_use]
pub fn wave91_cls_mid_shell() -> bool {
    get_rating(WebVitalName::Cls, 0.15) == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Cls, WEB_VITALS_CLS_GOOD) == MetricRating::Good
        && get_rating(WebVitalName::Cls, WEB_VITALS_CLS_POOR + 0.01) == MetricRating::Poor
        && thresholds_for(WebVitalName::Cls) == (WEB_VITALS_CLS_GOOD, WEB_VITALS_CLS_POOR)
}

/// Dual-oracle residual: LCP poor edge + constants.
#[must_use]
pub fn wave91_lcp_poor_shell() -> bool {
    get_rating(WebVitalName::Lcp, WEB_VITALS_LCP_POOR_MS + 1.0) == MetricRating::Poor
        && get_rating(WebVitalName::Lcp, WEB_VITALS_LCP_GOOD_MS) == MetricRating::Good
        && get_rating(WebVitalName::Lcp, WEB_VITALS_LCP_GOOD_MS + 1.0)
            == MetricRating::NeedsImprovement
        && WEB_VITALS_LCP_GOOD_MS == 2_500.0
        && WEB_VITALS_LCP_POOR_MS == 4_000.0
}

/// Dual-oracle residual: score needs 50 + ladder dual-oracle.
#[must_use]
pub fn wave91_score_needs_shell() -> bool {
    rating_score_points(MetricRating::NeedsImprovement) == 50
        && rating_score_points(MetricRating::Good) == 100
        && rating_score_points(MetricRating::Poor) == 0
        && MetricRating::NeedsImprovement.as_str() == "needs-improvement"
}

/// Dual-oracle residual: rating wire strings closed.
#[must_use]
pub fn wave91_rating_wire_shell() -> bool {
    MetricRating::Good.as_str() == "good"
        && MetricRating::Poor.as_str() == "poor"
        && MetricRating::NeedsImprovement.as_str() == "needs-improvement"
}

/// Dual-oracle residual: INP good boundary + constants dual-oracle.
#[must_use]
pub fn wave91_inp_good_shell() -> bool {
    get_rating(WebVitalName::Inp, WEB_VITALS_INP_GOOD_MS) == MetricRating::Good
        && get_rating(WebVitalName::Inp, WEB_VITALS_INP_GOOD_MS + 1.0)
            == MetricRating::NeedsImprovement
        && WEB_VITALS_INP_GOOD_MS == 200.0
        && WEB_VITALS_INP_POOR_MS == 500.0
        && thresholds_for(WebVitalName::Inp)
            == (WEB_VITALS_INP_GOOD_MS, WEB_VITALS_INP_POOR_MS)
}

#[cfg(test)]
mod wave91_tests {
    use super::*;

    #[test]
    fn wave91_web_vitals_cls_lcp_score_wire_inp_dual_oracle() {
        assert!(wave91_cls_mid_shell());
        assert!(wave91_lcp_poor_shell());
        assert!(wave91_score_needs_shell());
        assert!(wave91_rating_wire_shell());
        assert!(wave91_inp_good_shell());
        assert!(wave90_score_good_shell());
    }
}

// ── wave92 pure residual dens: web-vitals FCP TTFB poor score ladder dual-oracle residual ──
// Dual-oracle residual of web-vitals thresholds pure halves.
// Browser PerformanceObserver residual retained. dens ≠ flip.

/// Dual-oracle residual: FCP good/needs/poor edges.
#[must_use]
pub fn wave92_fcp_edges_shell() -> bool {
    get_rating(WebVitalName::Fcp, WEB_VITALS_FCP_GOOD_MS) == MetricRating::Good
        && get_rating(WebVitalName::Fcp, WEB_VITALS_FCP_GOOD_MS + 1.0)
            == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Fcp, WEB_VITALS_FCP_POOR_MS + 1.0) == MetricRating::Poor
        && WEB_VITALS_FCP_GOOD_MS == 1_800.0
        && WEB_VITALS_FCP_POOR_MS == 3_000.0
}

/// Dual-oracle residual: TTFB edges + constants.
#[must_use]
pub fn wave92_ttfb_edges_shell() -> bool {
    get_rating(WebVitalName::Ttfb, WEB_VITALS_TTFB_GOOD_MS) == MetricRating::Good
        && get_rating(WebVitalName::Ttfb, WEB_VITALS_TTFB_GOOD_MS + 1.0)
            == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Ttfb, WEB_VITALS_TTFB_POOR_MS + 1.0) == MetricRating::Poor
        && WEB_VITALS_TTFB_GOOD_MS == 800.0
        && WEB_VITALS_TTFB_POOR_MS == 1_800.0
}

/// Dual-oracle residual: poor score 0 dual-oracle.
#[must_use]
pub fn wave92_poor_score_shell() -> bool {
    rating_score_points(MetricRating::Poor) == 0
        && rating_score_points(MetricRating::Good) == 100
        && rating_score_points(MetricRating::NeedsImprovement) == 50
        && MetricRating::Poor.as_str() == "poor"
}

/// Dual-oracle residual: all metrics good strictly below poor.
#[must_use]
pub fn wave92_good_below_poor_shell() -> bool {
    WEB_VITALS_FCP_GOOD_MS < WEB_VITALS_FCP_POOR_MS
        && WEB_VITALS_LCP_GOOD_MS < WEB_VITALS_LCP_POOR_MS
        && WEB_VITALS_INP_GOOD_MS < WEB_VITALS_INP_POOR_MS
        && WEB_VITALS_TTFB_GOOD_MS < WEB_VITALS_TTFB_POOR_MS
        && WEB_VITALS_CLS_GOOD < WEB_VITALS_CLS_POOR
}

/// Dual-oracle residual: threshold pairs dual-oracle closed.
#[must_use]
pub fn wave92_threshold_pairs_shell() -> bool {
    thresholds_for(WebVitalName::Fcp) == (WEB_VITALS_FCP_GOOD_MS, WEB_VITALS_FCP_POOR_MS)
        && thresholds_for(WebVitalName::Ttfb)
            == (WEB_VITALS_TTFB_GOOD_MS, WEB_VITALS_TTFB_POOR_MS)
        && thresholds_for(WebVitalName::Cls) == (WEB_VITALS_CLS_GOOD, WEB_VITALS_CLS_POOR)
}

#[cfg(test)]
mod wave92_tests {
    use super::*;

    #[test]
    fn wave92_web_vitals_fcp_ttfb_poor_score_ladder_dual_oracle() {
        assert!(wave92_fcp_edges_shell());
        assert!(wave92_ttfb_edges_shell());
        assert!(wave92_poor_score_shell());
        assert!(wave92_good_below_poor_shell());
        assert!(wave92_threshold_pairs_shell());
        assert!(wave91_inp_good_shell());
    }
}

// ── wave93 pure residual dens: web-vitals LCP INP CLS score wire dual-oracle residual ──
// Dual-oracle residual of web-vitals thresholds pure halves.
// Browser PerformanceObserver residual retained. dens ≠ flip.

/// Dual-oracle residual: LCP good/needs/poor edges.
#[must_use]
pub fn wave93_lcp_edges_shell() -> bool {
    get_rating(WebVitalName::Lcp, WEB_VITALS_LCP_GOOD_MS) == MetricRating::Good
        && get_rating(WebVitalName::Lcp, WEB_VITALS_LCP_GOOD_MS + 1.0)
            == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Lcp, WEB_VITALS_LCP_POOR_MS + 1.0) == MetricRating::Poor
        && WEB_VITALS_LCP_GOOD_MS == 2_500.0
        && WEB_VITALS_LCP_POOR_MS == 4_000.0
}

/// Dual-oracle residual: INP edges + constants.
#[must_use]
pub fn wave93_inp_edges_shell() -> bool {
    get_rating(WebVitalName::Inp, WEB_VITALS_INP_GOOD_MS) == MetricRating::Good
        && get_rating(WebVitalName::Inp, WEB_VITALS_INP_GOOD_MS + 1.0)
            == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Inp, WEB_VITALS_INP_POOR_MS + 1.0) == MetricRating::Poor
        && WEB_VITALS_INP_GOOD_MS == 200.0
        && WEB_VITALS_INP_POOR_MS == 500.0
}

/// Dual-oracle residual: CLS edges dual-oracle.
#[must_use]
pub fn wave93_cls_edges_shell() -> bool {
    get_rating(WebVitalName::Cls, WEB_VITALS_CLS_GOOD) == MetricRating::Good
        && get_rating(WebVitalName::Cls, WEB_VITALS_CLS_GOOD + 0.001)
            == MetricRating::NeedsImprovement
        && get_rating(WebVitalName::Cls, WEB_VITALS_CLS_POOR + 0.001) == MetricRating::Poor
        && WEB_VITALS_CLS_GOOD == 0.1
        && WEB_VITALS_CLS_POOR == 0.25
}

/// Dual-oracle residual: score wire + rating strings.
#[must_use]
pub fn wave93_score_wire_shell() -> bool {
    rating_score_points(MetricRating::Good) == 100
        && rating_score_points(MetricRating::NeedsImprovement) == 50
        && rating_score_points(MetricRating::Poor) == 0
        && MetricRating::Good.as_str() == "good"
        && MetricRating::NeedsImprovement.as_str() == "needs-improvement"
}

/// Dual-oracle residual: threshold pairs LCP/INP/CLS dual-oracle.
#[must_use]
pub fn wave93_threshold_pairs_shell() -> bool {
    thresholds_for(WebVitalName::Lcp) == (WEB_VITALS_LCP_GOOD_MS, WEB_VITALS_LCP_POOR_MS)
        && thresholds_for(WebVitalName::Inp) == (WEB_VITALS_INP_GOOD_MS, WEB_VITALS_INP_POOR_MS)
        && thresholds_for(WebVitalName::Cls) == (WEB_VITALS_CLS_GOOD, WEB_VITALS_CLS_POOR)
}

#[cfg(test)]
mod wave93_tests {
    use super::*;

    #[test]
    fn wave93_web_vitals_lcp_inp_cls_score_wire_dual_oracle() {
        assert!(wave93_lcp_edges_shell());
        assert!(wave93_inp_edges_shell());
        assert!(wave93_cls_edges_shell());
        assert!(wave93_score_wire_shell());
        assert!(wave93_threshold_pairs_shell());
        assert!(wave92_fcp_edges_shell());
    }
}
