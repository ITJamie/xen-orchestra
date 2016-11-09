import _ from 'intl'
import ActionRowButton from 'action-row-button'
import ActionToggle from 'action-toggle'
import Component from 'base-component'
import filter from 'lodash/filter'
import find from 'lodash/find'
import forEach from 'lodash/forEach'
import get from 'lodash/get'
import Icon from 'icon'
import Link from 'link'
import LogList from '../../logs'
import map from 'lodash/map'
import orderBy from 'lodash/orderBy'
import React from 'react'
import SortedTable from 'sorted-table'
import Tooltip from 'tooltip'
import { addSubscriptions } from 'utils'
import { ButtonGroup } from 'react-bootstrap-4/lib'
import { createSelector } from 'selectors'
import {
  Card,
  CardHeader,
  CardBlock
} from 'card'
import {
  deleteBackupSchedule,
  disableSchedule,
  enableSchedule,
  runJob,
  subscribeJobs,
  subscribeSchedules,
  subscribeScheduleTable,
  subscribeUsers
} from 'xo'

// ===================================================================

const jobKeyToLabel = {
  continuousReplication: _('continuousReplication'),
  deltaBackup: _('deltaBackup'),
  disasterRecovery: _('disasterRecovery'),
  rollingBackup: _('backup'),
  rollingSnapshot: _('rollingSnapshot')
}

const JOB_COLUMNS = [
  {
    name: _('job'),
    itemRenderer: ({ jobId, jobLabel }) => <span>{jobId.slice(4, 8)} ({jobLabel})</span>,
    sortCriteria: 'jobId'
  },
  {
    name: _('jobTag'),
    itemRenderer: ({ scheduleTag }) => scheduleTag
  },
  {
    name: _('jobScheduling'),
    itemRenderer: ({ schedule }) => schedule.cron,
    sortCriteria: ({ schedule }) => schedule.cron
  },
  {
    name: _('jobTimezone'),
    itemRenderer: ({ schedule }) => schedule.timezone || _('jobServerTimezone'),
    sortCriteria: ({ schedule }) => schedule.timezone
  },
  {
    name: _('jobState'),
    itemRenderer: ({ schedule, scheduleToggleValue }) => <ActionToggle
      value={scheduleToggleValue}
      handler={scheduleToggleValue ? disableSchedule : enableSchedule}
      handlerParam={schedule.id}
      size='small'
    />,
    sortCriteria: 'scheduleToggleValue'
  },
  {
    itemRenderer: ({ schedule }, isRunnableJob) => <fieldset className='pull-right'>
      <Tooltip content={_('backupUserNotFound')}>{!isRunnableJob[schedule.id] && <Icon className='mr-1' icon='error' />}</Tooltip>
      <Link className='btn btn-sm btn-primary mr-1' to={`/backup/${schedule.id}/edit`}>
        <Icon icon='edit' />
      </Link>
      <ButtonGroup>
        <ActionRowButton
          icon='delete'
          btnStyle='danger'
          handler={deleteBackupSchedule}
          handlerParam={schedule}
        />
        <ActionRowButton
          disabled={!isRunnableJob[schedule.id]}
          icon='run-schedule'
          btnStyle='warning'
          handler={runJob}
          handlerParam={schedule.job}
        />
      </ButtonGroup>
    </fieldset>
  }
]

// ===================================================================

@addSubscriptions({
  users: subscribeUsers
})
export default class Overview extends Component {
  constructor (props) {
    super(props)
    this.state = {
      schedules: [],
      scheduleTable: {}
    }
  }

  componentWillMount () {
    const unsubscribeJobs = subscribeJobs(jobs => {
      const obj = {}
      forEach(jobs, job => { obj[job.id] = job })

      this.setState({
        jobs: obj
      })
    })

    const unsubscribeSchedules = subscribeSchedules(schedules => {
      // Get only backup jobs.
      schedules = filter(schedules, schedule => {
        const job = this.state.jobs && this.state.jobs[schedule.job]
        return job && jobKeyToLabel[job.key]
      })

      this.setState({
        schedules: orderBy(schedules, schedule => +schedule.id.split(':')[1], ['desc'])
      })
    })

    const unsubscribeScheduleTable = subscribeScheduleTable(scheduleTable => {
      this.setState({
        scheduleTable
      })
    })

    this.componentWillUnmount = () => {
      unsubscribeJobs()
      unsubscribeSchedules()
      unsubscribeScheduleTable()
    }
  }

  _getScheduleCollection = createSelector(
    () => this.state.schedules,
    () => this.state.scheduleTable,
    () => this.state.jobs,
    (schedules, scheduleTable, jobs) => {
      if (!schedules || !jobs) {
        return []
      }

      return map(schedules, schedule => {
        const job = jobs[schedule.job]
        const { items } = job.paramsVector

        return {
          jobId: job.id,
          jobLabel: jobKeyToLabel[job.key] || _('unknownSchedule'),
          // Old versions of XenOrchestra use items[0]
          scheduleTag: get(items, '[0].values[0].tag') || get(items, '[1].values[0].tag') || schedule.id,
          schedule,
          scheduleToggleValue: scheduleTable && scheduleTable[schedule.id]
        }
      })
    }
  )

  _getIsRunnableJob = createSelector(
    () => this.state.schedules,
    () => this.state.jobs,
    () => this.props.users,
    (schedules, jobs, users) => {
      const isRunnableJob = {}
      forEach(schedules, schedule => {
        isRunnableJob[schedule.id] = !!(jobs && find(users, user => user.id === jobs[schedule.job].userId))
      })

      return isRunnableJob
    }
  )

  render () {
    const {
      schedules
    } = this.state

    const isRunnableJob = this._getIsRunnableJob()

    return (
      <div>
        <Card>
          <CardHeader>
            <h5><Icon icon='schedule' /> {_('backupSchedules')}</h5>
          </CardHeader>
          <CardBlock>
            {schedules.length ? (
              <SortedTable columns={JOB_COLUMNS} collection={this._getScheduleCollection()} userData={isRunnableJob} />
            ) : <p>{_('noScheduledJobs')}</p>}
          </CardBlock>
        </Card>
        <LogList jobKeys={Object.keys(jobKeyToLabel)} />
      </div>
    )
  }
}
