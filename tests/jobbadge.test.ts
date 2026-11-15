// The Job Centre badge (owner, 1.9.13: "fix the job notification coming up all
// the time"). In work it counts only vacancies not yet seen; opening the Job
// Centre sees them all; out of work it counts every open one.
import { describe, expect, it } from 'vitest'
import { newGame } from '../src/game/newgame'
import { jobBadge, markJobsSeen } from '../src/game/jobs'

function withJobs() {
  const g = newGame('northampton', 'Badge', 31)
  const others = Object.keys(g.clubs).filter(id => id !== g.userClubId).slice(0, 3)
  g.vacancies = others.map(clubId => ({ clubId, week: g.week }))
  return { g, others }
}

describe('the Job Centre badge', () => {
  it('in work: every new vacancy counts until the Job Centre is opened', () => {
    const { g } = withJobs()
    expect(jobBadge(g)).toBe(3)
    expect(markJobsSeen(g)).toBe(true)
    expect(jobBadge(g)).toBe(0)
    // nothing new, nothing changes
    expect(markJobsSeen(g)).toBe(false)
  })
  it('a vacancy posted after the visit lights it again, on its own', () => {
    const { g } = withJobs()
    markJobsSeen(g)
    const next = Object.keys(g.clubs).find(id => id !== g.userClubId && !g.vacancies.some(v => v.clubId === id))!
    g.vacancies.push({ clubId: next, week: g.week })
    expect(jobBadge(g)).toBe(1)
  })
  it('out of work: every open job counts, seen or not', () => {
    const { g } = withJobs()
    markJobsSeen(g)
    g.unemployed = true
    expect(jobBadge(g)).toBe(3)
  })
  it('a job turned down or applied for never counts', () => {
    const { g } = withJobs()
    g.vacancies[0].passed = true
    g.vacancies[1].applied = true
    expect(jobBadge(g)).toBe(1)
    g.unemployed = true
    expect(jobBadge(g)).toBe(1)
  })
})
