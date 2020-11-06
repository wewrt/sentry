from __future__ import absolute_import

import logging

from django import forms

from sentry.rules.actions.base import IntegrationEventAction
from sentry.shared_integrations.exceptions import IntegrationError

logger = logging.getLogger("sentry.rules")


class JiraNotifyServiceForm(forms.Form):
    jira_integration = forms.ChoiceField(choices=(), widget=forms.Select())
    assignee = forms.ChoiceField(choices=(), widget=forms.Select())
    components = forms.ChoiceField(choices=(), widget=forms.Select())
    description = forms.ChoiceField(choices=(), widget=forms.Select())
    duedate = forms.ChoiceField(choices=(), widget=forms.Select())
    fixVersions = forms.ChoiceField(choices=(), widget=forms.Select())
    issuetype = forms.ChoiceField(choices=(), widget=forms.Select())
    labels = forms.ChoiceField(choices=(), widget=forms.Select())
    priority = forms.ChoiceField(choices=(), widget=forms.Select())
    project = forms.ChoiceField(choices=(), widget=forms.Select())
    reporter = forms.ChoiceField(choices=(), widget=forms.Select())

    def __init__(self, *args, **kwargs):
        projects_list = [(i.id, i.name) for i in kwargs.pop("integrations")]
        super(JiraNotifyServiceForm, self).__init__(*args, **kwargs)

        # TODO MARCOS FIRST why isn't the default sticking around?
        if projects_list:
            self.fields["jira_integration"].initial = projects_list[0][0]

        self.fields["jira_integration"].choices = projects_list
        self.fields["jira_integration"].widget.choices = self.fields["jira_integration"].choices

    def clean(self):
        """
        TODO DESCRIBE
        :return:
        """
        return super(JiraNotifyServiceForm, self).clean()


class JiraCreateTicketAction(IntegrationEventAction):
    form_cls = JiraNotifyServiceForm
    label = u"""Create a Jira ticket in the {jira_integration} account
    and {project} project
    of type {issuetype}
    with components {components}
    and due date {duedate}
    with fixVersions {fixVersions}
    assigned to {assignee}
    reported by {reporter}
    label {labels}
    priority {priority}"""
    prompt = "Create a Jira ticket"
    provider = "jira"
    integration_key = "jira_integration"

    def __init__(self, *args, **kwargs):
        # TODO make sure the selected integration has permissions
        super(JiraCreateTicketAction, self).__init__(*args, **kwargs)
        integrations_by_id = {
            integration.id: integration for integration in self.get_integrations()
        }

        integration_choices = [(i.id, i.name) for i in integrations_by_id.values()]
        selected_integration_id = self.get_integration_id() or integration_choices[0][0]
        self.form_fields = {
            "jira_integration": {
                "choices": integration_choices,
                "default": selected_integration_id,
                "type": "choice",
                "updatesForm": True,
            }
        }

        # TODO MARCOS figure out string and integer
        selected_integration = integrations_by_id.get(int(selected_integration_id))
        installation = selected_integration.get_installation(self.project.organization.id)
        if installation:
            try:
                fields = installation.get_create_issue_config_no_params()
            except IntegrationError as e:
                # TODO log when the API call fails.
                logger.info(e)
            else:
                self.update_form_fields_from_jira_fields(fields)

    def after(self, event, state):
        pass

    def update_form_fields_from_jira_fields(self, fields_list):
        """
        TODO DESCRIBE

        :param fields_list: TODO
        :return: Object TODO
        """
        self.form_fields.update(
            {
                field["name"]: {
                    key: ({"select": "choice", "text": "string"}.get(value, value))
                    if key == "type"
                    else value
                    for key, value in field.items()
                    if key != "updatesForm"
                }
                for field in fields_list
                if field["name"]
            }
        )
