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
    And the page title contains "Organisations"

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
