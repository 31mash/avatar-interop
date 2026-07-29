/* Project Tracker — seed data
   Dates are generated relative to "today" so the demo always shows a live-looking
   portfolio: on-track, at-risk, overdue, on-hold, submitted, draft, completed. */

(function () {
  'use strict';

  const pad = (n) => String(n).padStart(2, '0');
  const base = new Date();
  base.setHours(0, 0, 0, 0);

  // date offset (days from today) -> "YYYY-MM-DD"
  const d = (n) => {
    const x = new Date(base.getFullYear(), base.getMonth(), base.getDate() + n);
    return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
  };
  // datetime offset -> "YYYY-MM-DDTHH:MM"
  const dt = (n, time) => `${d(n)}T${time}`;

  // most recent Tuesday (for the recurring weekly meetup anchor)
  const toTue = (2 - base.getDay() + 7) % 7;
  const anchorTue = toTue - 56; // 8 weeks of history

  window.buildSeed = function buildSeed() {
    return {
      version: 1,
      users: [
        { id: 'u1', name: 'Dana Whitfield', role: 'boss', dept: 'Leadership', title: 'Studio Director', active: true },
        { id: 'u2', name: 'Marcus Chen', role: 'pm', dept: 'Production', title: 'Project Manager', active: true },
        { id: 'u3', name: 'Priya Nair', role: 'hr', dept: 'People Ops', title: 'HR & Coordination', active: true },
        { id: 'u4', name: 'Jordan Lee', role: 'team', dept: 'Avatars', title: 'Avatar Engineer', active: true },
        { id: 'u5', name: 'Sofia Ramos', role: 'team', dept: 'Wearables', title: '3D Wearables Artist', active: true },
        { id: 'u6', name: 'Theo Okafor', role: 'team', dept: 'Animation', title: 'Technical Animator', active: true },
        { id: 'u7', name: 'Mia Tanaka', role: 'team', dept: 'Web', title: 'Creative Developer', active: true }
      ],

      projects: [
        {
          id: 'p1', name: 'VRM Avatar Builder v2', dept: 'Avatars', priority: 'High',
          desc: 'Second major release of the open-source avatar builder: new rig import module, texture atlas pipeline and one-click VRM/GLB export presets.',
          managerId: 'u2', ownerId: 'u4', teamIds: ['u4', 'u6', 'u7'],
          status: 'in-progress',
          timeline: {
            proposedStart: d(-20), proposedEnd: d(25),
            baselineStart: d(-20), baselineEnd: d(25),
            currentStart: d(-20), currentEnd: d(25)
          },
          progressOverride: null, completionRequested: false, createdAt: dt(-26, '10:00')
        },
        {
          id: 'p2', name: 'M3taloot Wearables Drop 3', dept: 'Wearables', priority: 'High',
          desc: 'Third seasonal drop of interoperable 3D loot wearables — 12 new assets, lookbook, marketing renders and on-chain deployment.',
          managerId: 'u2', ownerId: 'u5', teamIds: ['u5', 'u6', 'u7'],
          status: 'in-progress',
          timeline: {
            proposedStart: d(-30), proposedEnd: d(10),
            baselineStart: d(-30), baselineEnd: d(10),
            currentStart: d(-30), currentEnd: d(17)
          },
          progressOverride: null, completionRequested: false, createdAt: dt(-36, '10:00')
        },
        {
          id: 'p3', name: 'Animation Retargeting Pipeline', dept: 'Animation', priority: 'Medium',
          desc: 'Shared mocap retargeting pipeline so animation clips move cleanly between game engines and virtual world runtimes.',
          managerId: 'u2', ownerId: 'u6', teamIds: ['u6', 'u4', 'u7'],
          status: 'in-progress',
          timeline: {
            proposedStart: d(-25), proposedEnd: d(12),
            baselineStart: d(-25), baselineEnd: d(12),
            currentStart: d(-25), currentEnd: d(12)
          },
          progressOverride: null, completionRequested: false, createdAt: dt(-30, '10:00')
        },
        {
          id: 'p4', name: 'Virtual Fashion Shoot — Fall', dept: 'Wearables', priority: 'Medium',
          desc: 'In-world fashion shoot for the fall wearables line: location scouting across three worlds, styled avatars, photography and a published lookbook.',
          managerId: 'u2', ownerId: 'u5', teamIds: ['u5', 'u7'],
          status: 'approved',
          timeline: {
            proposedStart: d(5), proposedEnd: d(40),
            baselineStart: d(5), baselineEnd: d(40),
            currentStart: d(5), currentEnd: d(40)
          },
          progressOverride: null, completionRequested: false, createdAt: dt(-10, '10:00')
        },
        {
          id: 'p5', name: 'CloneX Interop Experiments', dept: 'Avatars', priority: 'Low',
          desc: 'Experiments converting CloneX avatars to VRM for cross-world use. Paused while external SDK licensing is renegotiated.',
          managerId: 'u2', ownerId: 'u4', teamIds: ['u4'],
          status: 'on-hold', holdReason: 'Waiting on external SDK licensing',
          timeline: {
            proposedStart: d(-40), proposedEnd: d(20),
            baselineStart: d(-40), baselineEnd: d(20),
            currentStart: d(-40), currentEnd: d(20)
          },
          progressOverride: null, completionRequested: false, createdAt: dt(-45, '10:00')
        },
        {
          id: 'p6', name: 'Community Site Redesign', dept: 'Web', priority: 'Medium',
          desc: 'Refresh of the community site: new project gallery, events calendar and contributor onboarding guide.',
          managerId: 'u2', ownerId: 'u7', teamIds: ['u7', 'u5'],
          status: 'completed', completedAt: d(-12),
          timeline: {
            proposedStart: d(-60), proposedEnd: d(-14),
            baselineStart: d(-60), baselineEnd: d(-14),
            currentStart: d(-60), currentEnd: d(-12)
          },
          progressOverride: null, completionRequested: false, createdAt: dt(-66, '10:00')
        },
        {
          id: 'p7', name: 'Avatar Optimization Toolkit', dept: 'Avatars', priority: 'Medium',
          desc: 'Proposed toolkit that analyses avatar files and suggests LOD, texture and bone-count optimizations to raise world CCU.',
          managerId: 'u2', ownerId: 'u4', teamIds: ['u4', 'u7'],
          status: 'submitted', submittedAt: dt(-1, '16:20'),
          timeline: {
            proposedStart: d(7), proposedEnd: d(52),
            baselineStart: null, baselineEnd: null,
            currentStart: d(7), currentEnd: d(52)
          },
          progressOverride: null, completionRequested: false, createdAt: dt(-4, '10:00')
        },
        {
          id: 'p8', name: 'Holiday Wearables Capsule', dept: 'Wearables', priority: 'Low',
          desc: 'Draft proposal for a small holiday capsule: 5 festive wearables plus one animated accessory.',
          managerId: 'u2', ownerId: 'u5', teamIds: ['u5'],
          status: 'draft',
          timeline: {
            proposedStart: d(20), proposedEnd: d(65),
            baselineStart: null, baselineEnd: null,
            currentStart: d(20), currentEnd: d(65)
          },
          progressOverride: null, completionRequested: false, createdAt: dt(-2, '10:00')
        },
        {
          id: 'p9', name: 'In-world Concert Stage', dept: 'Web', priority: 'Low',
          desc: 'Interactive concert stage world with reactive lighting rig for live avatar performances.',
          managerId: 'u2', ownerId: 'u7', teamIds: ['u7'],
          status: 'rejected', rejectReason: 'Overlaps with the Q4 live-events initiative; revisit in January.',
          timeline: {
            proposedStart: d(10), proposedEnd: d(70),
            baselineStart: null, baselineEnd: null,
            currentStart: d(10), currentEnd: d(70)
          },
          progressOverride: null, completionRequested: false, createdAt: dt(-9, '10:00')
        }
      ],

      tasks: [
        // p1 — VRM Avatar Builder v2 (on track)
        { id: 't101', projectId: 'p1', title: 'Spec & scope lock', assigneeId: 'u4', status: 'done', progress: 100, weight: 1, critical: false, start: d(-20), end: d(-14), actualEnd: d(-14) },
        { id: 't102', projectId: 'p1', title: 'Core rig import module', assigneeId: 'u4', status: 'active', progress: 75, weight: 3, critical: true, start: d(-13), end: d(4), baselineStart: d(-13), baselineEnd: d(4) },
        { id: 't103', projectId: 'p1', title: 'Texture atlas pipeline', assigneeId: 'u7', status: 'active', progress: 60, weight: 2, critical: false, start: d(-10), end: d(8) },
        { id: 't104', projectId: 'p1', title: 'Export presets: VRM / GLB', assigneeId: 'u4', status: 'todo', progress: 0, weight: 3, critical: true, start: d(5), end: d(18) },
        { id: 't105', projectId: 'p1', title: 'QA pass across 5 worlds', assigneeId: 'u6', status: 'todo', progress: 0, weight: 2, critical: false, start: d(14), end: d(23) },

        // p2 — M3taloot Drop 3 (at risk: open blocker + slipped timeline)
        { id: 't201', projectId: 'p2', title: 'Concept & moodboard', assigneeId: 'u5', status: 'done', progress: 100, weight: 1, critical: false, start: d(-30), end: d(-24), actualEnd: d(-24) },
        { id: 't202', projectId: 'p2', title: '3D modeling: 12 wearables', assigneeId: 'u5', status: 'active', progress: 65, weight: 3, critical: true, start: d(-23), end: d(2) },
        { id: 't203', projectId: 'p2', title: 'Fabric sim & weight painting', assigneeId: 'u6', status: 'active', progress: 40, weight: 3, critical: true, start: d(-12), end: d(8), baselineStart: d(-12), baselineEnd: d(1) },
        { id: 't204', projectId: 'p2', title: 'Marketing renders', assigneeId: 'u7', status: 'todo', progress: 0, weight: 1, critical: false, start: d(6), end: d(14) },
        { id: 't205', projectId: 'p2', title: 'Mint & deploy', assigneeId: 'u7', status: 'todo', progress: 0, weight: 2, critical: true, start: d(12), end: d(16), baselineStart: d(5), baselineEnd: d(9) },

        // p3 — Animation Retargeting Pipeline (overdue critical task)
        { id: 't301', projectId: 'p3', title: 'Skeleton audit across engines', assigneeId: 'u6', status: 'done', progress: 100, weight: 1, critical: false, start: d(-25), end: d(-18), actualEnd: d(-18) },
        { id: 't302', projectId: 'p3', title: 'Retarget core skeleton map', assigneeId: 'u6', status: 'active', progress: 80, weight: 3, critical: true, start: d(-17), end: d(-3) },
        { id: 't303', projectId: 'p3', title: 'Batch conversion CLI', assigneeId: 'u4', status: 'active', progress: 30, weight: 2, critical: false, start: d(-8), end: d(6) },
        { id: 't304', projectId: 'p3', title: 'Validation suite & docs', assigneeId: 'u7', status: 'todo', progress: 0, weight: 2, critical: false, start: d(2), end: d(11) },

        // p4 — Virtual Fashion Shoot (approved, not started)
        { id: 't401', projectId: 'p4', title: 'Location scouting in 3 worlds', assigneeId: 'u5', status: 'todo', progress: 0, weight: 1, critical: false, start: d(5), end: d(12) },
        { id: 't402', projectId: 'p4', title: 'Avatar styling & fitting', assigneeId: 'u5', status: 'todo', progress: 0, weight: 2, critical: true, start: d(13), end: d(24) },
        { id: 't403', projectId: 'p4', title: 'Shoot & retouch', assigneeId: 'u7', status: 'todo', progress: 0, weight: 2, critical: false, start: d(25), end: d(34) },
        { id: 't404', projectId: 'p4', title: 'Publish lookbook', assigneeId: 'u7', status: 'todo', progress: 0, weight: 1, critical: false, start: d(35), end: d(40) },

        // p5 — CloneX (on hold)
        { id: 't501', projectId: 'p5', title: 'Rig conversion prototype', assigneeId: 'u4', status: 'active', progress: 50, weight: 2, critical: false, start: d(-40), end: d(-10) },
        { id: 't502', projectId: 'p5', title: 'Material & shader mapping', assigneeId: 'u4', status: 'todo', progress: 0, weight: 2, critical: false, start: d(-9), end: d(15) },

        // p6 — Community Site Redesign (completed)
        { id: 't601', projectId: 'p6', title: 'Information architecture', assigneeId: 'u7', status: 'done', progress: 100, weight: 1, critical: false, start: d(-60), end: d(-50), actualEnd: d(-50) },
        { id: 't602', projectId: 'p6', title: 'Visual design & build', assigneeId: 'u7', status: 'done', progress: 100, weight: 3, critical: true, start: d(-49), end: d(-24), actualEnd: d(-25) },
        { id: 't603', projectId: 'p6', title: 'Content migration', assigneeId: 'u5', status: 'done', progress: 100, weight: 2, critical: false, start: d(-24), end: d(-12), actualEnd: d(-12) },

        // p7 — Avatar Optimization Toolkit (submitted; proposed plan)
        { id: 't701', projectId: 'p7', title: 'Analyzer core (bones, tris, textures)', assigneeId: 'u4', status: 'todo', progress: 0, weight: 3, critical: true, start: d(7), end: d(28) },
        { id: 't702', projectId: 'p7', title: 'Report UI & suggestions', assigneeId: 'u7', status: 'todo', progress: 0, weight: 2, critical: false, start: d(24), end: d(45) },
        { id: 't703', projectId: 'p7', title: 'Docs & sample avatars', assigneeId: 'u4', status: 'todo', progress: 0, weight: 1, critical: false, start: d(44), end: d(52) },

        // p8 — Holiday capsule (draft)
        { id: 't801', projectId: 'p8', title: 'Concept sketches', assigneeId: 'u5', status: 'todo', progress: 0, weight: 1, critical: false, start: d(20), end: d(30) },
        { id: 't802', projectId: 'p8', title: 'Model 5 wearables + accessory', assigneeId: 'u5', status: 'todo', progress: 0, weight: 3, critical: true, start: d(31), end: d(58) }
      ],

      milestones: [
        { id: 'm101', projectId: 'p1', title: 'Alpha build', date: d(-2), done: true },
        { id: 'm102', projectId: 'p1', title: 'Beta build', date: d(12), done: false },
        { id: 'm103', projectId: 'p1', title: 'Ship v2', date: d(25), done: false },
        { id: 'm201', projectId: 'p2', title: 'Lookbook locked', date: d(-5), done: true },
        { id: 'm202', projectId: 'p2', title: 'Drop 3 live', date: d(17), done: false },
        { id: 'm301', projectId: 'p3', title: 'Pipeline demo day', date: d(7), done: false },
        { id: 'm401', projectId: 'p4', title: 'Shoot day', date: d(30), done: false },
        { id: 'm601', projectId: 'p6', title: 'Site relaunch', date: d(-12), done: true },
        { id: 'm801', projectId: 'p8', title: 'Capsule reveal', date: d(60), done: false }
      ],

      dependencies: [
        { id: 'd1', predecessorId: 't102', successorId: 't104', type: 'finish-start' },
        { id: 'd2', predecessorId: 't104', successorId: 't105', type: 'finish-start' },
        { id: 'd3', predecessorId: 't202', successorId: 't204', type: 'finish-start' },
        { id: 'd4', predecessorId: 't302', successorId: 't304', type: 'finish-start' }
      ],

      blockers: [
        {
          id: 'b1', projectId: 'p2', taskId: 't203', severity: 'High', status: 'open',
          desc: 'Cape assets clip through legacy avatar rigs — fabric sim needs a collision-mesh rework.',
          ownerId: 'u6', nextReview: d(2), reportedAt: dt(-2, '14:05'), reporterId: 'u6'
        },
        {
          id: 'b2', projectId: 'p3', taskId: 't302', severity: 'Medium', status: 'resolved',
          desc: 'Bone naming mismatch between engine exports broke the mapping table.',
          ownerId: 'u6', nextReview: d(-6), reportedAt: dt(-10, '09:30'), reporterId: 'u4', resolvedAt: dt(-6, '17:00')
        }
      ],

      meetings: [
        {
          id: 'mt1', title: 'Avatar Interop Weekly', date: d(anchorTue), time: '20:00', durationMin: 60,
          participantIds: ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7'], projectId: 'p1',
          agenda: 'Show & tell, project updates, standards feedback.',
          location: 'Discord — stage channel', recurrence: 'weekly', createdBy: 'u3',
          notes: '', attendance: {}, actionItems: [], cancelled: false
        },
        {
          id: 'mt2', title: 'Drop 3 go / no-go', date: d(2), time: '15:00', durationMin: 45,
          participantIds: ['u1', 'u2', 'u3', 'u5', 'u6'], projectId: 'p2',
          agenda: 'Review cape blocker status and decide whether the drop date holds.',
          location: 'Studio meeting room / video link', recurrence: null, createdBy: 'u3',
          notes: '', attendance: {}, actionItems: [], cancelled: false
        },
        {
          id: 'mt3', title: 'Fashion shoot logistics', date: d(6), time: '11:00', durationMin: 30,
          participantIds: ['u2', 'u3', 'u5'], projectId: 'p4',
          agenda: 'World access, styling schedule and photographer availability.',
          location: 'Video link', recurrence: null, createdBy: 'u3',
          notes: '', attendance: {}, actionItems: [], cancelled: false
        },
        {
          id: 'mt4', title: 'Production retro — June', date: d(-7), time: '16:00', durationMin: 60,
          participantIds: ['u2', 'u3', 'u4', 'u5', 'u6', 'u7'], projectId: null,
          agenda: 'What went well, what slipped, process fixes.',
          location: 'Studio meeting room', recurrence: null, createdBy: 'u3',
          notes: 'QA keeps starting too late; agreed to draft a shared checklist. Wearables handoff to web is smooth now.',
          attendance: { u2: true, u3: true, u4: true, u5: true, u6: false, u7: true },
          actionItems: [
            { id: 'ai1', text: 'Draft QA checklist for cross-world testing', ownerId: 'u6', status: 'proposed', projectId: 'p1' }
          ],
          cancelled: false
        }
      ],

      comments: [
        {
          id: 'c1', parentType: 'project', parentId: 'p2', authorId: 'u1',
          body: '@Marcus Chen can we still protect the drop date if the cape blocker slips past Friday? I would rather cut two assets than move the date again.',
          mentions: ['u2'], at: dt(-1, '09:12'), editedAt: null
        },
        {
          id: 'c2', parentType: 'project', parentId: 'p2', authorId: 'u6',
          body: 'Collision-mesh rework is halfway done. I will post a test render on the task before the go / no-go call.',
          mentions: [], at: dt(-1, '11:47'), editedAt: null
        },
        {
          id: 'c3', parentType: 'project', parentId: 'p1', authorId: 'u4',
          body: 'Rig import now handles twist bones correctly — beta scope is safe.',
          mentions: [], at: dt(-3, '15:30'), editedAt: null
        }
      ],

      audit: [
        { id: 'a1', at: dt(-26, '10:00'), userId: 'u4', action: 'created', recordType: 'project', recordId: 'p1', detail: 'Draft created' },
        { id: 'a2', at: dt(-24, '09:00'), userId: 'u4', action: 'submitted', recordType: 'project', recordId: 'p1', detail: 'Proposal submitted; dates locked' },
        { id: 'a3', at: dt(-23, '11:30'), userId: 'u2', action: 'approved', recordType: 'project', recordId: 'p1', detail: 'Baseline timeline created' },
        { id: 'a4', at: dt(-20, '09:15'), userId: 'u2', action: 'started', recordType: 'project', recordId: 'p1', detail: 'Moved to In progress' },
        { id: 'a5', at: dt(-36, '10:00'), userId: 'u5', action: 'created', recordType: 'project', recordId: 'p2', detail: 'Draft created' },
        { id: 'a6', at: dt(-33, '14:00'), userId: 'u2', action: 'approved', recordType: 'project', recordId: 'p2', detail: 'Baseline timeline created' },
        {
          id: 'a7', at: dt(-3, '16:40'), userId: 'u2', action: 'timeline-changed', recordType: 'project', recordId: 'p2',
          field: 'currentEnd', prev: d(10), next: d(17),
          reason: 'Fabric sim rework for cape assets needs one extra sprint.'
        },
        { id: 'a8', at: dt(-30, '10:00'), userId: 'u6', action: 'created', recordType: 'project', recordId: 'p3', detail: 'Draft created' },
        { id: 'a9', at: dt(-27, '12:00'), userId: 'u2', action: 'approved', recordType: 'project', recordId: 'p3', detail: 'Baseline timeline created' },
        { id: 'a10', at: dt(-10, '10:20'), userId: 'u2', action: 'approved', recordType: 'project', recordId: 'p4', detail: 'Baseline timeline created' },
        {
          id: 'a11', at: dt(-15, '15:00'), userId: 'u2', action: 'on-hold', recordType: 'project', recordId: 'p5',
          reason: 'Waiting on external SDK licensing'
        },
        { id: 'a12', at: dt(-12, '18:00'), userId: 'u2', action: 'completed', recordType: 'project', recordId: 'p6', detail: 'All deliverables shipped' },
        { id: 'a13', at: dt(-1, '16:20'), userId: 'u4', action: 'submitted', recordType: 'project', recordId: 'p7', detail: 'Proposal submitted; dates locked' },
        {
          id: 'a14', at: dt(-5, '13:10'), userId: 'u2', action: 'rejected', recordType: 'project', recordId: 'p9',
          reason: 'Overlaps with the Q4 live-events initiative; revisit in January.'
        },
        { id: 'a15', at: dt(-2, '14:05'), userId: 'u6', action: 'blocker-reported', recordType: 'blocker', recordId: 'b1', detail: 'High severity blocker on Fabric sim & weight painting' }
      ],

      notifications: [
        { id: 'n1', userId: 'u2', type: 'submitted', text: 'Jordan Lee submitted “Avatar Optimization Toolkit” for review.', refType: 'project', refId: 'p7', at: dt(-1, '16:20'), read: false },
        { id: 'n2', userId: 'u2', type: 'blocker', text: 'High severity blocker reported on “M3taloot Wearables Drop 3”.', refType: 'project', refId: 'p2', at: dt(-2, '14:05'), read: false },
        { id: 'n3', userId: 'u2', type: 'mention', text: 'Dana Whitfield mentioned you in a comment on “M3taloot Wearables Drop 3”.', refType: 'project', refId: 'p2', at: dt(-1, '09:12'), read: false },
        { id: 'n4', userId: 'u1', type: 'timeline', text: 'Committed end date of “M3taloot Wearables Drop 3” moved out by 7 days.', refType: 'project', refId: 'p2', at: dt(-3, '16:40'), read: false },
        { id: 'n5', userId: 'u1', type: 'overdue', text: 'Critical task “Retarget core skeleton map” is overdue on “Animation Retargeting Pipeline”.', refType: 'project', refId: 'p3', at: dt(0, '08:00'), read: false },
        { id: 'n6', userId: 'u6', type: 'overdue', text: 'Your critical task “Retarget core skeleton map” is overdue.', refType: 'project', refId: 'p3', at: dt(0, '08:00'), read: false },
        { id: 'n7', userId: 'u4', type: 'task', text: 'You were assigned “Export presets: VRM / GLB” on “VRM Avatar Builder v2”.', refType: 'project', refId: 'p1', at: dt(-6, '10:00'), read: true },
        { id: 'n8', userId: 'u5', type: 'meeting', text: '“Drop 3 go / no-go” scheduled — please review the agenda.', refType: 'meeting', refId: 'mt2', at: dt(-2, '15:30'), read: false },
        { id: 'n9', userId: 'u6', type: 'deadline', text: '“Fabric sim & weight painting” is approaching its due date.', refType: 'project', refId: 'p2', at: dt(0, '08:00'), read: false },
        { id: 'n10', userId: 'u3', type: 'action-item', text: 'Retro action item “Draft QA checklist” is awaiting Project Manager approval.', refType: 'meeting', refId: 'mt4', at: dt(-6, '09:00'), read: true },
        { id: 'n11', userId: 'u7', type: 'task', text: 'You were assigned “Marketing renders” on “M3taloot Wearables Drop 3”.', refType: 'project', refId: 'p2', at: dt(-4, '11:00'), read: true }
      ]
    };
  };
})();
