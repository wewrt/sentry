import React from 'react';

import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import SentryTypes from 'app/sentryTypes';
import withOrganization from 'app/utils/withOrganization';
import DashboardDetail from 'app/views/dashboardsV2/detail';

import Dashboard from './dashboard';
import overviewDashboard from './data/dashboards/overviewDashboard';

class OverviewDashboard extends AsyncView {
  getEndpoints() {
    return [['releases', `/organizations/${this.props.params.orgId}/releases/`]];
  }

  getTitle() {
    return t('Dashboard - %s', this.props.params.orgId);
  }

  renderLoading() {
    // We don't want a loading state
    return this.renderBody();
  }

  renderBody() {
    // Passing the rest of `this.props` to `<Dashboard>` for tests
    const {router, ...props} = this.props;

    return (
      <Dashboard
        releases={this.state.releases}
        releasesLoading={this.state.loading}
        router={router}
        {...overviewDashboard}
        {...props}
      />
    );
  }
}

function DashboardLanding(props) {
  const {organization, ...restProps} = props;

  const showDashboardV2 = organization.features.includes('dashboards-v2');

  if (showDashboardV2) {
    return <DashboardDetail {...restProps} />;
  }

  return <OverviewDashboard {...restProps} />;
}

DashboardLanding.propTypes = {
  organization: SentryTypes.Organization,
};

export default withOrganization(DashboardLanding);
