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
  Scenario: About page renders
    When I GET "/about"
    Then the response status is 200
    And the page title contains "About"

  @feature
  Scenario: Governance page renders
    When I GET "/governance"
    Then the response status is 200
    And the page title contains "Governance"

  @feature
  Scenario: Related projects page renders
    When I GET "/related-projects"
    Then the response status is 200
    And the page title contains "Related Projects"

  @feature
  Scenario: Community page renders
    When I GET "/community"
    Then the response status is 200
    And the page title contains "Community"

  @feature
  Scenario: News and events page renders
    When I GET "/news-events"
    Then the response status is 200
    And the page title contains "News & Events"

  @feature
  Scenario: Publishing tools page renders
    When I GET "/publishing-tools"
    Then the response status is 200
    And the page title contains "Publishing"

  @drupal
  Scenario: Login route works
    When I GET "/user/login"
    Then the response status is 200
