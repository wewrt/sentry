import $ from 'jquery';
// eslint-disable-next-line no-restricted-imports
import {Flex, Box} from 'reflexbox';
import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';
import classNames from 'classnames';

import {GlobalSelection, Group, NewQuery, Organization, User} from 'app/types';
import {PanelItem} from 'app/components/panels';
import {valueIsEqual} from 'app/utils';
import AssigneeSelector from 'app/components/assigneeSelector';
import Count from 'app/components/count';
import DropdownMenu from 'app/components/dropdownMenu';
import EventOrGroupExtraDetails from 'app/components/eventOrGroupExtraDetails';
import EventOrGroupHeader from 'app/components/eventOrGroupHeader';
import GroupChart from 'app/components/stream/groupChart';
import GroupCheckBox from 'app/components/stream/groupCheckBox';
import GroupStore from 'app/stores/groupStore';
import GuideAnchor from 'app/components/assistant/guideAnchor';
import MenuItem from 'app/components/menuItem';
import SelectedGroupStore from 'app/stores/selectedGroupStore';
import space from 'app/styles/space';
import SentryTypes from 'app/sentryTypes';
import {getRelativeSummary} from 'app/components/organizations/timeRangeSelector/utils';
import {DEFAULT_STATS_PERIOD} from 'app/constants';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import withOrganization from 'app/utils/withOrganization';
import EventView from 'app/utils/discover/eventView';
import {t} from 'app/locale';
import Link from 'app/components/links/link';
import {queryToObj} from 'app/utils/stream';
import {callIfFunction} from 'app/utils/callIfFunction';
import TimesBadge from 'app/components/group/timesBadge';
import InboxReason from 'app/components/group/inboxReason';

const DiscoveryExclusionFields: string[] = [
  'query',
  'status',
  'bookmarked_by',
  'assigned',
  'assigned_to',
  'unassigned',
  'subscribed_by',
  'active_at',
  'first_release',
  'first_seen',
  'is',
  '__text',
];

const defaultProps = {
  statsPeriod: '24h',
  canSelect: true,
  withChart: true,
  useFilteredStats: false,
};

type Props = {
  id: string;
  selection: GlobalSelection;
  organization: Organization;
  query?: string;
  hasGuideAnchor?: boolean;
  memberList?: User[];
  /** >=1 group is in the inbox and should display the reason or a placeholder */
  hasInboxReason?: boolean;
  // TODO(ts): higher order functions break defaultprops export types
} & Partial<typeof defaultProps>;

type State = {
  data: Group;
};

class StreamGroup extends React.Component<Props, State> {
  static propTypes: any = {
    id: PropTypes.string.isRequired,
    statsPeriod: PropTypes.string.isRequired,
    canSelect: PropTypes.bool,
    query: PropTypes.string,
    hasGuideAnchor: PropTypes.bool,
    memberList: PropTypes.array,
    withChart: PropTypes.bool,
    selection: SentryTypes.GlobalSelection.isRequired,
    organization: SentryTypes.Organization.isRequired,
    useFilteredStats: PropTypes.bool,
    hasInboxReason: PropTypes.bool,
  };

  static defaultProps = defaultProps;

  state: State = this.getInitialState();

  getInitialState(): State {
    const {id, useFilteredStats} = this.props;

    const data = GroupStore.get(id) as Group;

    return {
      data: {
        ...data,
        filtered: useFilteredStats ? data.filtered : undefined,
      },
    };
  }

  componentWillReceiveProps(nextProps: Props) {
    if (
      nextProps.id !== this.props.id ||
      nextProps.useFilteredStats !== this.props.useFilteredStats
    ) {
      const data = GroupStore.get(this.props.id) as Group;

      this.setState({
        data: {
          ...data,
          filtered: nextProps.useFilteredStats ? data.filtered : undefined,
        },
      });
    }
  }

  shouldComponentUpdate(nextProps: Props, nextState: State) {
    if (nextProps.statsPeriod !== this.props.statsPeriod) {
      return true;
    }
    if (!valueIsEqual(this.state.data, nextState.data)) {
      return true;
    }
    return false;
  }

  componentWillUnmount() {
    callIfFunction(this.listener);
  }

  listener = GroupStore.listen(itemIds => this.onGroupChange(itemIds), undefined);

  onGroupChange(itemIds: Set<string>) {
    const {id} = this.props;
    if (!itemIds.has(id)) {
      return;
    }

    const data = GroupStore.get(id) as Group;
    this.setState({data});
  }

  toggleSelect = (evt: React.MouseEvent<HTMLDivElement>) => {
    if ((evt.target as HTMLElement)?.tagName === 'A') {
      return;
    }
    if ((evt.target as HTMLElement)?.tagName === 'INPUT') {
      return;
    }
    if ($(evt.target).parents('a').length !== 0) {
      return;
    }

    SelectedGroupStore.toggleSelect(this.state.data.id);
  };

  getDiscoverUrl(isFiltered?: boolean) {
    const {organization, query, selection} = this.props;
    const {data} = this.state;

    // when there is no discover feature open events page
    const hasDiscoverQuery = organization.features.includes('discover-basic');

    const queryTerms: string[] = [];

    if (isFiltered && query) {
      const queryObj = queryToObj(query);
      for (const queryTag in queryObj)
        if (!DiscoveryExclusionFields.includes(queryTag)) {
          const queryVal = queryObj[queryTag].includes(' ')
            ? `"${queryObj[queryTag]}"`
            : queryObj[queryTag];
          queryTerms.push(`${queryTag}:${queryVal}`);
        }

      if (queryObj.__text) {
        queryTerms.push(queryObj.__text);
      }
    }

    const commonQuery = {projects: [Number(data.project.id)]};

    const searchQuery = (queryTerms.length ? ' ' : '') + queryTerms.join(' ');

    if (hasDiscoverQuery) {
      const {period, start, end} = selection.datetime || {};

      const discoverQuery: NewQuery = {
        ...commonQuery,
        id: undefined,
        name: data.title || data.type,
        fields: ['title', 'release', 'environment', 'user', 'timestamp'],
        orderby: '-timestamp',
        query: `issue.id:${data.id}${searchQuery}`,
        version: 2,
      };

      if (!!start && !!end) {
        discoverQuery.start = String(start);
        discoverQuery.end = String(end);
      } else {
        discoverQuery.range = period || DEFAULT_STATS_PERIOD;
      }

      const discoverView = EventView.fromSavedQuery(discoverQuery);
      return discoverView.getResultsViewUrlTarget(organization.slug);
    }

    return {
      pathname: `/organizations/${organization.slug}/issues/${data.id}/events/`,
      query: {
        ...commonQuery,
        query: searchQuery,
      },
    };
  }

  render() {
    const {data} = this.state;
    const {
      query,
      hasGuideAnchor,
      canSelect,
      memberList,
      withChart,
      statsPeriod,
      selection,
      organization,
      hasInboxReason,
    } = this.props;

    const {period, start, end} = selection.datetime || {};
    const summary =
      !!start && !!end
        ? 'time range'
        : getRelativeSummary(period || DEFAULT_STATS_PERIOD).toLowerCase();

    const primaryCount = data.filtered ? data.filtered.count : data.count;
    const secondaryCount = data.filtered ? data.count : undefined;
    const primaryUserCount = data.filtered ? data.filtered.userCount : data.userCount;
    const secondaryUserCount = data.filtered ? data.userCount : undefined;

    const showSecondaryPoints = Boolean(
      withChart && data && data.filtered && statsPeriod
    );

    const hasInbox = organization.features.includes('inbox');

    return (
      <Wrapper data-test-id="group" onClick={this.toggleSelect}>
        {canSelect && (
          <GroupCheckbox ml={2}>
            <GroupCheckBox id={data.id} />
          </GroupCheckbox>
        )}
        <GroupSummary
          width={[8 / 12, 8 / 12, 6 / 12]}
          ml={canSelect ? 1 : 2}
          mr={1}
          flex="1"
        >
          <EventOrGroupHeader includeLink data={data} query={query} size="normal" />
          <EventOrGroupExtraDetails data={data} />
        </GroupSummary>
        {hasGuideAnchor && <GuideAnchor target="issue_stream" />}
        {withChart && (
          <Box width={160} mx={2} className="hidden-xs hidden-sm">
            <GroupChart
              statsPeriod={statsPeriod!}
              data={data}
              showSecondaryPoints={showSecondaryPoints}
            />
          </Box>
        )}
        <Flex width={[40, 60, 80, 80]} mx={2} justifyContent="flex-end">
          <DropdownMenu isNestedDropdown>
            {({isOpen, getRootProps, getActorProps, getMenuProps}) => {
              const topLevelCx = classNames('dropdown', {
                'anchor-middle': true,
                open: isOpen,
              });

              return (
                <GuideAnchor target="dynamic_counts" disabled={!hasGuideAnchor}>
                  <span
                    {...getRootProps({
                      className: topLevelCx,
                    })}
                  >
                    <span {...getActorProps({})}>
                      <div className="dropdown-actor-title">
                        <PrimaryCount value={primaryCount} />
                        {secondaryCount !== undefined && (
                          <SecondaryCount value={secondaryCount} />
                        )}
                      </div>
                    </span>
                    <StyledDropdownList
                      {...getMenuProps({className: 'dropdown-menu inverted'})}
                    >
                      {data.filtered && (
                        <React.Fragment>
                          <StyledMenuItem to={this.getDiscoverUrl(true)}>
                            <MenuItemText>{t('Matching search filters')}</MenuItemText>
                            <MenuItemCount value={data.filtered.count} />
                          </StyledMenuItem>
                          <MenuItem divider />
                        </React.Fragment>
                      )}

                      <StyledMenuItem to={this.getDiscoverUrl()}>
                        <MenuItemText>{t(`Total in ${summary}`)}</MenuItemText>
                        <MenuItemCount value={data.count} />
                      </StyledMenuItem>

                      {data.lifetime && (
                        <React.Fragment>
                          <MenuItem divider />
                          <StyledMenuItem>
                            <MenuItemText>{t('Since issue began')}</MenuItemText>
                            <MenuItemCount value={data.lifetime.count} />
                          </StyledMenuItem>
                        </React.Fragment>
                      )}
                    </StyledDropdownList>
                  </span>
                </GuideAnchor>
              );
            }}
          </DropdownMenu>
        </Flex>
        <Flex width={[40, 60, 80, 80]} mx={2} justifyContent="flex-end">
          <DropdownMenu isNestedDropdown>
            {({isOpen, getRootProps, getActorProps, getMenuProps}) => {
              const topLevelCx = classNames('dropdown', {
                'anchor-middle': true,
                open: isOpen,
              });

              return (
                <span
                  {...getRootProps({
                    className: topLevelCx,
                  })}
                >
                  <span {...getActorProps({})}>
                    <div className="dropdown-actor-title">
                      <PrimaryCount value={primaryUserCount} />
                      {secondaryUserCount !== undefined && (
                        <SecondaryCount dark value={secondaryUserCount} />
                      )}
                    </div>
                  </span>
                  <StyledDropdownList
                    {...getMenuProps({className: 'dropdown-menu inverted'})}
                  >
                    {data.filtered && (
                      <React.Fragment>
                        <StyledMenuItem to={this.getDiscoverUrl(true)}>
                          <MenuItemText>{t('Matching search filters')}</MenuItemText>
                          <MenuItemCount value={data.filtered.userCount} />
                        </StyledMenuItem>
                        <MenuItem divider />
                      </React.Fragment>
                    )}

                    <StyledMenuItem to={this.getDiscoverUrl()}>
                      <MenuItemText>{t(`Total in ${summary}`)}</MenuItemText>
                      <MenuItemCount value={data.userCount} />
                    </StyledMenuItem>

                    {data.lifetime && (
                      <React.Fragment>
                        <MenuItem divider />
                        <StyledMenuItem>
                          <MenuItemText>{t('Since issue began')}</MenuItemText>
                          <MenuItemCount value={data.lifetime.userCount} />
                        </StyledMenuItem>
                      </React.Fragment>
                    )}
                  </StyledDropdownList>
                </span>
              );
            }}
          </DropdownMenu>
        </Flex>
        <Box width={80} mx={2} className="hidden-xs hidden-sm">
          <AssigneeSelector id={data.id} memberList={memberList} />
        </Box>
        {hasInbox && (
          <React.Fragment>
            {hasInboxReason && (
              <ReasonBox width={95} mx={2} className="hidden-xs hidden-sm">
                <BadgeWrapper>
                  {data.inbox ? <InboxReason inbox={data.inbox} /> : <div />}
                </BadgeWrapper>
              </ReasonBox>
            )}
            <TimesBox width={170} mx={2} className="hidden-xs hidden-sm">
              <BadgeWrapper>
                <TimesBadge
                  lastSeen={data.lifetime?.lastSeen || data.lastSeen}
                  firstSeen={data.lifetime?.firstSeen || data.firstSeen}
                />
              </BadgeWrapper>
            </TimesBox>
          </React.Fragment>
        )}
      </Wrapper>
    );
  }
}

const Wrapper = styled(PanelItem)`
  padding: ${space(1)} 0;
  align-items: center;
  line-height: 1.1;
`;

const GroupSummary = styled(Box)`
  overflow: hidden;
`;

const ReasonBox = styled(Box)`
  margin: 0 ${space(0.25)} 0 ${space(1)};
`;

const TimesBox = styled(Box)`
  margin: 0 ${space(1.5)} 0 ${space(0.5)};
`;

const GroupCheckbox = styled(Box)`
  align-self: flex-start;
  & input[type='checkbox'] {
    margin: 0;
    display: block;
  }
`;

const PrimaryCount = styled(Count)`
  font-size: ${p => p.theme.fontSizeLarge};
`;

const SecondaryCount = styled(({value, ...p}) => <Count {...p} value={value} />)`
  font-size: ${p => p.theme.fontSizeLarge};

  :before {
    content: '/';
    padding-left: ${space(0.25)};
    padding-right: 2px;
    color: ${p => p.theme.gray300};
  }
`;

const StyledDropdownList = styled('ul')`
  z-index: ${p => p.theme.zIndex.hovercard};
`;

const StyledMenuItem = styled(({to, children, ...p}) => (
  <MenuItem noAnchor>
    {to ? (
      // @ts-expect-error allow target _blank for this link to open in new window
      <Link to={to} target="_blank">
        <div {...p}>{children}</div>
      </Link>
    ) : (
      <div className="dropdown-toggle">
        <div {...p}>{children}</div>
      </div>
    )}
  </MenuItem>
))`
  margin: 0;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
`;

const MenuItemCount = styled(({value, ...p}) => (
  <div {...p}>
    <Count value={value} />
  </div>
))`
  text-align: right;
  font-weight: bold;
  padding-left: ${space(1)};
`;

const MenuItemText = styled('div')`
  white-space: nowrap;
  font-weight: normal;
  text-align: left;
  padding-right: ${space(1)};
`;

const BadgeWrapper = styled('div')`
  display: flex;
  justify-content: center;
`;

export default withGlobalSelection(withOrganization(StreamGroup));
