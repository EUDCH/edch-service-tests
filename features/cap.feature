Feature: EDCH CAP baseline
  The CAP (Common Access Point) must be reachable, serve a valid certificate, render its
  homepage, and expose its key sections: about, governance, related projects, community,
  news & events, and publishing tools. Routes and markers verified live against prod 2026-06-26.

  Background:
    Given the "cap" service

  @smoke
  Scenario: Homepage is up and renders
    When I GET "/"
    Then the response status is 200
    And the response body contains "European Diamond Capacity Hub"

  @smoke @tls
  Scenario: TLS certificate is valid
    Then the TLS certificate is valid for at least 14 days

  @feature
  Scenario: About page is available
    When I GET "/about"
    Then the response status is 200
    And the response body contains "about"

  @feature
  Scenario: Governance page is available
    When I GET "/governance"
    Then the response status is 200
    And the response body contains "governance"

  @feature
  Scenario: Related projects page is available
    When I GET "/related-projects"
    Then the response status is 200

  @feature
  Scenario: Community page is available
    When I GET "/community"
    Then the response status is 200

  @feature
  Scenario: News and events page is available
    When I GET "/news-events"
    Then the response status is 200
    And the response body contains "news"

  @feature
  Scenario: Publishing tools page is available
    When I GET "/publishing-tools"
    Then the response status is 200

  @drupal
  Scenario: Login route works
    When I GET "/user/login"
    Then the response status is 200
