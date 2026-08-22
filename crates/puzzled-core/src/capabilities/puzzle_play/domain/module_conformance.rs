//! Shared module conformance oracle (PZL-110).
//!
//! A module becomes customer-reachable only when every protocol surface is
//! present. Catalog membership without these surfaces is not admission.
//! Client interaction and non-spoiler mapping are supplied as evidence from
//! the presentation registry; this module is the sole admission gate.

use super::game_slugs::is_valid_game_slug;

/// Protocol surfaces required before a module may be customer-reachable.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ModuleSurface {
    Metadata,
    ContentSource,
    Interaction,
    TerminalContract,
    ServerValidator,
    CanonicalRecord,
    Reentry,
    NonSpoilerResult,
}

impl ModuleSurface {
    #[must_use]
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Metadata => "metadata",
            Self::ContentSource => "content_source",
            Self::Interaction => "interaction",
            Self::TerminalContract => "terminal_contract",
            Self::ServerValidator => "server_validator",
            Self::CanonicalRecord => "canonical_record",
            Self::Reentry => "reentry",
            Self::NonSpoilerResult => "non_spoiler_result",
        }
    }
}

/// Required surfaces in stable oracle order.
pub const REQUIRED_SURFACES: [ModuleSurface; 8] = [
    ModuleSurface::Metadata,
    ModuleSurface::ContentSource,
    ModuleSurface::Interaction,
    ModuleSurface::TerminalContract,
    ModuleSurface::ServerValidator,
    ModuleSurface::CanonicalRecord,
    ModuleSurface::Reentry,
    ModuleSurface::NonSpoilerResult,
];

/// Evidence that each protocol surface exists for one module.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct ModuleSurfaceEvidence {
    pub metadata: bool,
    pub content_source: bool,
    pub interaction: bool,
    pub terminal_contract: bool,
    pub server_validator: bool,
    pub canonical_record: bool,
    pub reentry: bool,
    pub non_spoiler_result: bool,
}

impl ModuleSurfaceEvidence {
    /// Surfaces still missing from this evidence.
    #[must_use]
    pub fn missing(self) -> Vec<ModuleSurface> {
        let mut missing = Vec::new();
        if !self.metadata {
            missing.push(ModuleSurface::Metadata);
        }
        if !self.content_source {
            missing.push(ModuleSurface::ContentSource);
        }
        if !self.interaction {
            missing.push(ModuleSurface::Interaction);
        }
        if !self.terminal_contract {
            missing.push(ModuleSurface::TerminalContract);
        }
        if !self.server_validator {
            missing.push(ModuleSurface::ServerValidator);
        }
        if !self.canonical_record {
            missing.push(ModuleSurface::CanonicalRecord);
        }
        if !self.reentry {
            missing.push(ModuleSurface::Reentry);
        }
        if !self.non_spoiler_result {
            missing.push(ModuleSurface::NonSpoilerResult);
        }
        missing
    }

    /// True when every required surface is present.
    #[must_use]
    pub fn is_protocol_complete(self) -> bool {
        self.missing().is_empty()
    }
}

/// A module is customer-reachable only when it is a registered slug and
/// protocol-complete. Complete-looking evidence for an unknown slug fails.
#[must_use]
pub fn is_customer_reachable(slug: &str, evidence: &ModuleSurfaceEvidence) -> bool {
    is_valid_game_slug(slug) && evidence.is_protocol_complete()
}

/// Admission failure for one customer-facing slug.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ConformanceFailure {
    pub slug: String,
    pub missing: Vec<ModuleSurface>,
}

/// Failures for customer-facing slugs that are not protocol-complete.
pub fn catalog_admission_failures<'a, I, F>(
    customer_slugs: I,
    mut evidence_for: F,
) -> Vec<ConformanceFailure>
where
    I: IntoIterator<Item = &'a str>,
    F: FnMut(&str) -> ModuleSurfaceEvidence,
{
    let mut failures = Vec::new();
    for slug in customer_slugs {
        let evidence = evidence_for(slug);
        if is_customer_reachable(slug, &evidence) {
            continue;
        }
        let mut missing = evidence.missing();
        if !is_valid_game_slug(slug) && !missing.contains(&ModuleSurface::Metadata) {
            missing.insert(0, ModuleSurface::Metadata);
        }
        failures.push(ConformanceFailure {
            slug: slug.to_string(),
            missing,
        });
    }
    failures
}

#[cfg(test)]
mod tests {
    use super::*;

    fn complete_evidence() -> ModuleSurfaceEvidence {
        ModuleSurfaceEvidence {
            metadata: true,
            content_source: true,
            interaction: true,
            terminal_contract: true,
            server_validator: true,
            canonical_record: true,
            reentry: true,
            non_spoiler_result: true,
        }
    }

    #[test]
    fn required_surfaces_are_the_protocol_eight() {
        assert_eq!(
            REQUIRED_SURFACES.map(ModuleSurface::as_str),
            [
                "metadata",
                "content_source",
                "interaction",
                "terminal_contract",
                "server_validator",
                "canonical_record",
                "reentry",
                "non_spoiler_result",
            ]
        );
    }

    #[test]
    fn complete_registered_module_is_customer_reachable() {
        let evidence = complete_evidence();
        assert!(evidence.is_protocol_complete());
        assert!(is_customer_reachable("sudoku", &evidence));
        assert!(catalog_admission_failures(["sudoku"], |_| evidence).is_empty());
    }

    #[test]
    fn missing_server_validator_blocks_admission() {
        let mut evidence = complete_evidence();
        evidence.server_validator = false;
        assert_eq!(evidence.missing(), vec![ModuleSurface::ServerValidator]);
        assert!(!is_customer_reachable("sudoku", &evidence));
        let failures = catalog_admission_failures(["sudoku"], |_| evidence);
        assert_eq!(failures.len(), 1);
        assert_eq!(failures[0].slug, "sudoku");
        assert_eq!(failures[0].missing, vec![ModuleSurface::ServerValidator]);
    }

    #[test]
    fn unknown_slug_is_not_reachable_even_with_complete_evidence() {
        let evidence = complete_evidence();
        assert!(!is_customer_reachable("brand-new-module", &evidence));
        let failures = catalog_admission_failures(["brand-new-module"], |_| evidence);
        assert_eq!(failures.len(), 1);
        assert_eq!(failures[0].slug, "brand-new-module");
        assert!(failures[0].missing.contains(&ModuleSurface::Metadata));
    }

    #[test]
    fn each_missing_surface_is_a_kill() {
        for surface in REQUIRED_SURFACES {
            let mut evidence = complete_evidence();
            match surface {
                ModuleSurface::Metadata => evidence.metadata = false,
                ModuleSurface::ContentSource => evidence.content_source = false,
                ModuleSurface::Interaction => evidence.interaction = false,
                ModuleSurface::TerminalContract => evidence.terminal_contract = false,
                ModuleSurface::ServerValidator => evidence.server_validator = false,
                ModuleSurface::CanonicalRecord => evidence.canonical_record = false,
                ModuleSurface::Reentry => evidence.reentry = false,
                ModuleSurface::NonSpoilerResult => evidence.non_spoiler_result = false,
            }
            assert!(
                !is_customer_reachable("crossword", &evidence),
                "{} must block admission",
                surface.as_str()
            );
        }
    }
}
