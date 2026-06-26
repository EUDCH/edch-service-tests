Feature: EDCH Resources & Guidelines baseline
  The Resources & Guidelines service (EIFL-hosted) must be reachable, serve a valid
  certificate, render its homepage, and expose its key sections: guidelines, the Diamond OA
  essentials, the getting-started guide, the glossary, and the about page. Routes and titles
  verified live against prod 2026-06-26.

  Background:
    Given the "resources" service

  @smoke
  Scenario: Homepage is up and renders
    When I GET "/"
    Then the response status is 200
    And the response body contains "Resources and Guidelines"

  @smoke @tls
  Scenario: TLS certificate is valid
    Then the TLS certificate is valid for at least 14 days

  @feature
  Scenario: Guidelines page renders
    When I GET "/guidelines"
    Then the response status is 200
    And the page title contains "Guidelines"

  @feature
  Scenario: Diamond OA essentials page renders
    When I GET "/diamond-oa-essentials"
    Then the response status is 200
    And the page title contains "Diamond OA Essentials"

  @feature
  Scenario: Getting started guide renders
    When I GET "/getting-started-diamond-oa"
    Then the response status is 200
    And the page title contains "Getting started with Diamond OA"

  @feature
  Scenario: Glossary page renders
    When I GET "/glossary"
    Then the response status is 200
    And the page title contains "Glossary"

  @feature
  Scenario: About page renders
    When I GET "/about"
    Then the response status is 200
    And the page title contains "About"

  @drupal
  Scenario: Login route works
    When I GET "/user/login"
    Then the response status is 200
    And the page title contains "Log in"
