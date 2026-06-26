Feature: EDCH Diamond Discovery Hub baseline
  The Diamond Discovery Hub (DDH) is the non-Drupal discovery service. It must be reachable,
  serve a valid certificate, render its homepage, expose the sources view and sitemap, and
  serve its localised variants (English and Polish). Routes and titles verified live 2026-06-26.

  Background:
    Given the "ddh" service

  @smoke
  Scenario: Homepage is up and renders
    When I GET "/"
    Then the response status is 200
    And the page title contains "Home"

  @smoke @tls
  Scenario: TLS certificate is valid
    Then the TLS certificate is valid for at least 14 days

  @feature
  Scenario: English homepage renders
    When I GET "/en"
    Then the response status is 200
    And the page title contains "Home"

  @feature
  Scenario: Sources view renders
    When I GET "/en/sources"
    Then the response status is 200
    And the page title contains "Sources"

  @feature
  Scenario: Polish localisation renders
    When I GET "/pl"
    Then the response status is 200
    And the page title contains "Strona główna"

  @feature
  Scenario: Sitemap renders
    When I GET "/sitemap"
    Then the response status is 200
    And the page title contains "Sitemap"

  @feature
  Scenario: Login page renders
    When I GET "/en/login"
    Then the response status is 200
    And the page title contains "Login"
