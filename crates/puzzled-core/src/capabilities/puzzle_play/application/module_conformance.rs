//! Server-side evidence for the shared module conformance oracle.

use crate::capabilities::puzzle_play::application::submission_validation::has_server_validator;
use crate::capabilities::puzzle_play::domain::game_slugs::{is_valid_game_slug, module_class_for};
use crate::capabilities::puzzle_play::domain::module_conformance::ModuleSurfaceEvidence;
use crate::capabilities::puzzle_play::domain::ritual_completion::{
    qualifies_as_ritual, submit_must_guard_already_played, RitualQualifyInput,
};

/// Surfaces the server can prove for `slug`.
///
/// Interaction and non-spoiler result mapping remain presentation evidence.
/// A catalog slug is not customer-reachable on this evidence alone.
#[must_use]
pub fn server_protocol_evidence(slug: &str) -> ModuleSurfaceEvidence {
    let registered = is_valid_game_slug(slug);
    let classified = module_class_for(slug).is_some();
    let validator = has_server_validator(slug);
    let ritual = qualifies_as_ritual(RitualQualifyInput {
        game_module_id: slug,
        mode: "daily",
        status: "won",
        is_dry_run: false,
    });
    ModuleSurfaceEvidence {
        metadata: registered && classified,
        content_source: registered,
        interaction: false,
        terminal_contract: validator,
        server_validator: validator,
        canonical_record: ritual,
        reentry: registered && submit_must_guard_already_played(true, None, true),
        non_spoiler_result: false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::capabilities::puzzle_play::domain::game_slugs::all_game_slugs;
    use crate::capabilities::puzzle_play::domain::module_conformance::{
        catalog_admission_failures, is_customer_reachable,
    };

    #[test]
    fn shipped_catalog_has_server_protocol_surfaces() {
        for slug in all_game_slugs() {
            let evidence = server_protocol_evidence(slug);
            assert!(evidence.metadata, "{slug} metadata");
            assert!(evidence.content_source, "{slug} content source");
            assert!(evidence.terminal_contract, "{slug} terminal contract");
            assert!(evidence.server_validator, "{slug} server validator");
            assert!(evidence.canonical_record, "{slug} canonical record");
            assert!(evidence.reentry, "{slug} reentry");
            assert!(
                !evidence.interaction && !evidence.non_spoiler_result,
                "{slug} client surfaces are not server-proven"
            );
            assert!(
                !evidence.is_protocol_complete(),
                "{slug} must still require client surfaces"
            );
            assert!(!is_customer_reachable(slug, &evidence));

            let mut complete = evidence;
            complete.interaction = true;
            complete.non_spoiler_result = true;
            assert!(
                is_customer_reachable(slug, &complete),
                "{slug} must be reachable once client surfaces are proven"
            );
        }
    }

    #[test]
    fn unvalidated_slug_cannot_enter_the_catalog() {
        let evidence = server_protocol_evidence("brand-new-module");
        assert!(!evidence.server_validator);
        assert!(!evidence.metadata);
        assert!(!evidence.canonical_record);
        assert!(!is_customer_reachable("brand-new-module", &evidence));
        assert_eq!(
            catalog_admission_failures(["brand-new-module"], |_| evidence).len(),
            1
        );
    }
}
