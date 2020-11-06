from __future__ import absolute_import


def get_integration_type(integration):
    metadata = integration.metadata
    # classic bots had a user_access_token in the metadata
    default_installation = "classic_bot" if "user_access_token" in metadata else "workspace_app"
    return metadata.get("installation_type", default_installation)


def get_issue_type_meta(issue_type, meta):
    """
    Get the issue_type metadata in the Jira metadata object if it exists,
    otherwise return whichever is first in the list.

    :param issue_type: The issue type as a string. E.g. "Story"
    :param meta: A Jira metadata object for creating tickets
    :return: The issue_type metadata object
    """
    issue_types = meta["issuetypes"]
    issue_type_meta = None
    if issue_type:
        matching_type = [t for t in issue_types if t["id"] == issue_type]
        issue_type_meta = matching_type[0] if len(matching_type) > 0 else None

    # still no issue type? just use the first one.
    if not issue_type_meta:
        issue_type_meta = issue_types[0]

    return issue_type_meta
