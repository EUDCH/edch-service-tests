Feature: EDCH Registry baseline
  Confirms the Registry's user-facing features work: it is reachable over a valid
  certificate, renders its pages, protects the organisation registration form,
  gates the organisation check behind login, obfuscates contact addresses, renders
  the computed address field, and answers the city lookup. Every scenario asserts a
  feature doing its job — none asserts the absence of a feature or an internal detail.

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
  Scenario: Organisation registration landing page renders
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
    # Full title keeps this distinct from "Organisations map | EDCH Registry".
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

  @feature
  Scenario: Login page renders
    When I GET "/user/login"
    Then the response status is 200
    And the page title contains "Log in"

  # organization_validation — the organisation registration form is login-protected.
  @feature @module
  Scenario: The organisation registration form requires login
    When I GET "/form/organisation-registry" without following redirects
    Then the response status is 403

  # organization_validation — the organisation check redirects anonymous users to login,
  # preserving the return destination.
  @feature @module
  Scenario: The organisation check is gated behind login
    When I GET "/check-organisation" without following redirects
    Then the response status is 302
    And the redirect location contains "/user/login"
    And the redirect location contains "destination=/check-organisation"

  # organization_validation — the confirmation page renders and shows the message it is given.
  @feature @module
  Scenario: The organisation-validation confirmation page renders its message
    When I GET "/organization-validation/confirmation?message=EDCH-SERVICE-TESTS-CANARY"
    Then the response status is 200
    And the response body contains "confirmation-message"
    And the response body contains "Process Completed"
    And the response body contains "EDCH-SERVICE-TESTS-CANARY"

  # email_protect — contact addresses on the listing render obfuscated, with none left raw.
  @feature @module
  Scenario: Contact addresses are obfuscated on the organisations listing
    When I GET "/organisations-view"
    Then the response status is 200
    And the rendered text contains "(at)"
    And the response body contains no email address
    And the response body contains no mailto link

  # computed_address — an organisation profile shows the computed "City, Country" value.
  # Asserting the rendered field value (not the wrapper class) fails if the module is off,
  # because Drupal omits an empty computed field from the output entirely.
  @feature @module
  Scenario: An organisation profile shows its computed address
    When I GET the first organisation profile linked from "/organisations-view"
    Then the response status is 200
    And the "field-map-address" field renders a non-empty value

  # email_protect — the same obfuscation on an organisation profile: the value carries "(at)"
  # and no raw address survives anywhere on the page.
  @feature @module
  Scenario: An organisation profile shows its obfuscated contact email
    When I GET the first organisation profile linked from "/organisations-view"
    Then the response status is 200
    And the "field-protected-email" field value contains "(at)"
    And the response body contains no email address

  # webform_geonames — the city lookup validates its input (no parameters → empty set, no
  # outbound call, so this cannot flake on the upstream API).
  @feature @module
  Scenario: The city lookup returns an empty set when parameters are missing
    When I GET "/webform-geonames/autocomplete"
    Then the response status is 200
    And the response content type is "application/json"
    And the JSON response is an empty array

  # webform_geonames — the city lookup returns real suggestions for a known city. Hits
  # api.geonames.org, hence @external; the controller swallows upstream errors into an empty
  # array, so a non-empty result is the only proof the lookup works.
  @feature @module @external
  Scenario: The city lookup returns suggestions for a known city
    When I GET "/webform-geonames/autocomplete?query=Copenhagen&country_code=DK"
    Then the response status is 200
    And the response content type is "application/json"
    And the JSON response is a non-empty array
    And every JSON item has the keys "value,label"
