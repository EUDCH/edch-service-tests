Feature: EDCH Registry baseline
  The Registry must be reachable, serve a valid certificate, render its homepage,
  and expose its core features: organisation registration, the forum, and the
  organisation listings/map. Routes and markers verified live against prod 2026-06-26.

  Background:
    Given the "registry" service

  @smoke
  Scenario: Homepage is up and renders
    When I GET "/"
    Then the response status is 200
    And the response body contains "EDCH Registry"

  @smoke @tls
  Scenario: TLS certificate is valid
    Then the TLS certificate is valid for at least 14 days

  @feature
  Scenario: Organisation registration page renders
    When I GET "/register"
    Then the response status is 200
    And the page title contains "Register"

  @feature
  Scenario: Forum renders
    When I GET "/forum"
    Then the response status is 200
    And the page title contains "Forum"

  @feature
  Scenario: Organisations listing renders
    When I GET "/organisations-view"
    Then the response status is 200
    # Full title keeps this distinct from "Organisations map | EDCH Registry"
    And the page title contains "Organisations | EDCH Registry"

  @feature
  Scenario: Organisations map renders
    When I GET "/organisations-map"
    Then the response status is 200
    And the page title contains "Organisations map"

  @feature
  Scenario: Documentation page renders
    When I GET "/documentation"
    Then the response status is 200
    And the page title contains "Documentation"

  @drupal
  Scenario: Login route works
    When I GET "/user/login"
    Then the response status is 200

  # ── Custom-module surface ──────────────────────────────────────────────────────
  # The Registry runs six custom modules (EUDCH/registry-drupal-modules). Release 1.3.0
  # declared Drupal 11 support in their .info.yml; declaring is not exercising, so the
  # scenarios below exercise each module's externally observable behaviour. Verified live
  # against both prod (Drupal 10) and the PCSS test instance (Drupal 11) on 2026-08-20 —
  # every assertion here holds on both, so the suite stays green across the migration.
  #
  # Two of the six, org_moderation_sync and organization_listing, are deployed but not
  # installed. They are covered only by the absence scenario at the end; see the README.

  @drupal
  Scenario: Site reports a supported Drupal major version
    When I GET "/"
    Then the response status is 200
    And the Drupal major version is at least 10
    # Set EDCH_EXPECT_DRUPAL_MAJOR=11 against the migrated instance to make this exact.
    And the Drupal major version equals "EDCH_EXPECT_DRUPAL_MAJOR" when that variable is set

  @feature @module
  Scenario: organization_validation serves its confirmation page and reflects the message
    When I GET "/organization-validation/confirmation?message=EDCH-SERVICE-TESTS-CANARY"
    Then the response status is 200
    And the response body contains "confirmation-message"
    And the response body contains "Process Completed"
    # The reflected marker proves the module's controller ran, not merely that some page exists.
    And the response body contains "EDCH-SERVICE-TESTS-CANARY"

  @feature @module
  Scenario: organization_validation gates check-organisation behind login
    When I GET "/check-organisation" without following redirects
    Then the response status is 302
    And the redirect location contains "/user/login"
    And the redirect location contains "destination=/check-organisation"

  @feature @module
  Scenario: an unrouted path under the same prefix is a 404
    # Positive control for the scenario above: proves a 302-to-login is a discriminating
    # result and not what this site returns for anything it does not recognise.
    When I GET "/check-organisation-not-a-route" without following redirects
    Then the response status is 404

  @feature @module
  Scenario: organization_validation exposes its submit route as POST-only
    When I GET "/organization-validation/manageSelectedOrganisations" without following redirects
    Then the response status is 405

  @feature @module
  Scenario: webform_geonames answers with an empty set when parameters are missing
    # The module's own validation branch: no outbound call, so this cannot flake on the
    # upstream Geonames API. This is the canary for "is the module routed at all".
    When I GET "/webform-geonames/autocomplete"
    Then the response status is 200
    And the response content type is "application/json"
    And the JSON response is an empty array

  @feature @module @external
  Scenario: webform_geonames returns place suggestions for a known city
    # Depends on api.geonames.org, hence @external. The controller swallows every upstream
    # error into an empty array, so a non-empty result is the only proof the lookup works.
    When I GET "/webform-geonames/autocomplete?query=Copenhagen&country_code=DK"
    Then the response status is 200
    And the response content type is "application/json"
    And the JSON response is a non-empty array
    And every JSON item has the keys "value,label"

  @feature @module
  Scenario: email_protect obfuscates contact addresses on the organisations listing
    When I GET "/organisations-view"
    Then the response status is 200
    # "(at)" is what this module substitutes for "@". Asserting the substitution AND the
    # absence of any raw address means the scenario fails whether the module is disabled
    # (addresses render intact) or its output changes shape.
    And the response body contains "(at)"
    And the response body contains no email address
    And the response body contains no mailto link

  @feature @module
  Scenario: computed_address renders a combined city and country on an organisation profile
    When I GET the first organisation profile linked from "/organisations-view"
    Then the response status is 200
    And the response body contains "field--name-field-map-address"
    And the response body contains "field--type-computed-string"

  @feature @module
  Scenario: email_protect renders as a computed field on an organisation profile
    When I GET the first organisation profile linked from "/organisations-view"
    Then the response status is 200
    And the response body contains "field--name-field-protected-email"
    And the response body contains "field--type-computed-string-long"
    And the response body contains no email address

  @feature @module @not-installed
  Scenario: organization_listing is not installed on this deployment
    # Recorded as a fact, not an aspiration: the module ships in the repo and is deployed to
    # the modules directory, but is not enabled on prod or test, so its route does not exist.
    # If it is ever enabled this scenario fails, which is the intended prompt to cover it.
    When I GET "/organizations" without following redirects
    Then the response status is 404
