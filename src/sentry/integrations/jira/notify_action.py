from __future__ import absolute_import

import logging

from django import forms

from sentry.rules.actions.base import IntegrationEventAction

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
        super(JiraNotifyServiceForm, self).__init__(*args, **kwargs)

    def clean(self):
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
        super(JiraCreateTicketAction, self).__init__(*args, **kwargs)
        # TODO 1.1 Add form_fields
        self.form_fields = {}

    def render_label(self):
        return self.label.format(name=self.get_integration_name())

    def after(self, event, state):
        pass
