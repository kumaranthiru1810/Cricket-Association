/**
 * seeds/seedCricketLaws.js
 *
 * Seeds the MongoDB database with all 42 MCC Cricket Laws
 * MCC 2017 Code – Fourth Edition 2026, Effective 1 October 2026
 *
 * Source: MCC Laws of Cricket – https://lawsofcricket.lords.org/
 * NOTE: Explanations are original educational summaries, not MCC verbatim text.
 * This application does not claim MCC certification or endorsement.
 *
 * Usage: node seeds/seedCricketLaws.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const db = require('../config/db');

function genId(prefix) {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `${prefix}-${ts}-${rand}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// All 42 Laws — MCC 2017 Code Fourth Edition 2026
// ─────────────────────────────────────────────────────────────────────────────
const LAWS_DATA = [
  {
    number: 1, title: 'The Players',
    category: 'Match Officials',
    short_description: 'Defines the composition of a cricket team — 11 players per side, playing roles and substitutes.',
    is_amended: false,
    sections: [
      { num: '1.1', title: 'Number of players', exp: 'A match is played between two sides, each of 11 players, one of whom shall be the captain.' },
      { num: '1.2', title: 'Nomination of players', exp: 'Before the toss, each captain shall nominate their 11 players. No player may be changed after the toss without the consent of the opposing captain.' },
      { num: '1.3', title: 'Substitutes and runners', exp: 'A substitute may field for an injured player but may not bat or bowl. The umpires, not the fielding captain, decide on the legitimacy of a substitute.' },
      { num: '1.4', title: 'Player returning without permission', exp: 'If a player leaves the field without permission, they cannot return without the umpires\' agreement and may be penalised.' }
    ]
  },
  {
    number: 2, title: 'The Umpires',
    category: 'Umpires',
    short_description: 'Covers the roles, responsibilities and authority of the two on-field umpires.',
    is_amended: false,
    sections: [
      { num: '2.1', title: 'Appointment and attendance', exp: 'Two umpires shall be appointed, one at each end of the pitch. They control the game with absolute authority on the field.' },
      { num: '2.2', title: 'Change of umpire', exp: 'No umpire shall be changed during a match without the consent of both captains, except in the case of illness or injury.' },
      { num: '2.3', title: 'Umpires are the sole judges', exp: 'The umpires are the sole judges of fair and unfair play. Their decisions are final and must be respected.' },
      { num: '2.4', title: 'Disagreement between umpires', exp: 'If umpires cannot agree, the matter shall be decided by the umpire at the bowler\'s end.' }
    ]
  },
  {
    number: 3, title: 'The Scorers',
    category: 'Scorers',
    short_description: 'Defines the duties and responsibilities of the two official scorers.',
    is_amended: false,
    sections: [
      { num: '3.1', title: 'Appointment of scorers', exp: 'Two scorers shall be appointed to record all runs scored, wickets taken and overs bowled.' },
      { num: '3.2', title: 'Correctness of scores', exp: 'The scorers shall frequently cross-check to ensure their scoring is consistent with each other.' },
      { num: '3.3', title: 'Acknowledging signals', exp: 'The scorers shall acknowledge each signal from the umpires by raising a hand.' }
    ]
  },
  {
    number: 4, title: 'The Ball',
    category: 'Equipment',
    short_description: 'Specifies the construction, weight, circumference and condition of the cricket ball.',
    is_amended: true,
    amendment_notes: 'Clarification on ball change procedures added in 2026 edition.',
    sections: [
      { num: '4.1', title: 'Weight and size', exp: 'The ball shall weigh between 155.9g and 163g, and shall have a circumference of between 22.4cm and 22.9cm.' },
      { num: '4.2', title: 'Approval and control of ball', exp: 'The bowling side has control of the ball. The fielding captain may change it if they wish, subject to umpire approval.' },
      { num: '4.3', title: 'New ball', exp: 'Unless agreed otherwise, the fielding side shall have the choice of taking a new ball at the start of each innings.' },
      { num: '4.4', title: 'Ball lost or becoming unfit', exp: 'If the ball is lost or becomes unfit for play, the umpires shall replace it with one of similar condition.' },
      { num: '4.5', title: 'Ball changing condition', exp: 'It is not illegal to polish the ball without using substances, remove mud, or dry with a towel. Altering its condition is prohibited.' }
    ]
  },
  {
    number: 5, title: 'The Bat',
    category: 'Equipment',
    short_description: 'Defines the dimensions, material and approved specifications of the cricket bat.',
    is_amended: true,
    amendment_notes: 'Updated bat width and handle specifications in 2026 edition.',
    sections: [
      { num: '5.1', title: 'Material', exp: 'The blade of the bat shall be made of wood. The handle shall be made of cane, wood or a combination.' },
      { num: '5.2', title: 'Size of bat', exp: 'The overall length shall not exceed 96.5cm. The width of the blade shall not exceed 10.8cm. Edge thickness and depth also specified.' },
      { num: '5.3', title: 'Approval of the bat', exp: 'The umpires may request to inspect the bat at any time and may request changes if it does not comply.' }
    ]
  },
  {
    number: 6, title: 'The Pitch',
    category: 'Match Situations',
    short_description: 'Defines the area of the pitch, its preparation, use and protection.',
    is_amended: false,
    sections: [
      { num: '6.1', title: 'Area of pitch', exp: 'The pitch is a rectangular area of ground 22 yards (20.12m) long and 10 feet (3.05m) wide.' },
      { num: '6.2', title: 'Selection and preparation', exp: 'Before the match, the pitch is chosen and prepared by the ground authority or, in their absence, the umpires.' },
      { num: '6.3', title: 'Changing the pitch', exp: 'The pitch shall not be changed during a match unless both captains agree, or unless the umpires decide it is unfit.' },
      { num: '6.4', title: 'Non-turf pitches', exp: 'Specifications for non-turf surfaces shall be agreed before the match.' }
    ]
  },
  {
    number: 7, title: 'The Crease',
    category: 'Match Situations',
    short_description: 'Defines the popping crease, bowling crease and return creases — their dimensions and purposes.',
    is_amended: false,
    sections: [
      { num: '7.1', title: 'The bowling crease', exp: 'The bowling crease shall be marked 22 yards from the other bowling crease, running through the stumps.' },
      { num: '7.2', title: 'The popping crease', exp: 'The popping crease is 4 feet in front of the bowling crease, parallel to it, and is considered to extend indefinitely.' },
      { num: '7.3', title: 'The return creases', exp: 'Return creases are perpendicular to the bowling crease, at least 8 feet 8 inches in length on either side of the middle stump.' }
    ]
  },
  {
    number: 8, title: 'The Wickets',
    category: 'Equipment',
    short_description: 'Specifies the construction, dimensions and placement of the three stumps and two bails.',
    is_amended: false,
    sections: [
      { num: '8.1', title: 'Width and pitching', exp: 'Three stumps shall be pitched in a straight line with the bowling crease. The stumps\' combined width is 9 inches (22.86cm).' },
      { num: '8.2', title: 'Height of the wickets', exp: 'The top of the stumps shall be 28 inches (71.1cm) above the playing surface.' },
      { num: '8.3', title: 'The bails', exp: 'Two bails shall be placed in position across the tops of the stumps. Each bail shall be 4 3/8 inches (11.1cm) overall.' }
    ]
  },
  {
    number: 9, title: 'Preparation and Maintenance of the Playing Area',
    category: 'Match Situations',
    short_description: 'Covers rolling, mowing, watering and covering of the pitch and outfield.',
    is_amended: false,
    sections: [
      { num: '9.1', title: 'Rolling', exp: 'The captain of the batting side may request rolling for no more than 7 minutes before the start of each innings.' },
      { num: '9.2', title: 'Sweeping and mowing', exp: 'The pitch may be swept and the outfield may be mowed under the supervision of the umpires.' },
      { num: '9.3', title: 'Watering', exp: 'The pitch shall not be watered during the match.' },
      { num: '9.4', title: 'Covering the pitch', exp: 'The pitch shall be protected from the elements when play is not taking place, subject to the match playing conditions.' }
    ]
  },
  {
    number: 10, title: 'Covering the Pitch',
    category: 'Match Situations',
    short_description: 'Detailed conditions for protecting the pitch from rain and dew before and during play.',
    is_amended: false,
    sections: [
      { num: '10.1', title: 'Before the match', exp: 'The entire pitch may be covered before the start of the match at the discretion of the ground authority.' },
      { num: '10.2', title: 'The pitch used for play', exp: 'The pitch used for play shall be covered when play is interrupted by rain or bad light, under the playing conditions.' }
    ]
  },
  {
    number: 11, title: 'Intervals',
    category: 'Match Situations',
    short_description: 'Defines lunch, tea, drinks and innings intervals — their timing and duration.',
    is_amended: true,
    amendment_notes: 'Clarified minimum over requirements before taking intervals, updated in 2026.',
    sections: [
      { num: '11.1', title: 'Intervals', exp: 'The match playing conditions shall determine the intervals, including lunch, tea, drinks breaks, and the interval between innings.' },
      { num: '11.2', title: 'Changing agreed time of intervals', exp: 'If a wicket falls within 30 minutes of an agreed interval, the interval may be taken immediately.' },
      { num: '11.3', title: 'Drinks intervals', exp: 'Players are entitled to a drinks break at agreed intervals. The umpires may refuse a drinks break if it would waste playing time.' }
    ]
  },
  {
    number: 12, title: 'Start of Play; Cessation of Play',
    category: 'Match Situations',
    short_description: 'Procedures for calling play, suspending play, and conditions for early finish.',
    is_amended: false,
    sections: [
      { num: '12.1', title: 'Start and restart of play', exp: 'The umpire calls "Play" to start the game. After an interval, play restarts with the same call.' },
      { num: '12.2', title: 'Cessation of play', exp: 'The umpire calls "Time" to end play. No bowler shall complete an over after "Time" has been called.' }
    ]
  },
  {
    number: 13, title: 'Innings',
    category: 'Match Situations',
    short_description: 'Defines the structure of innings — who bats, when an innings ends, and follow-on rules.',
    is_amended: true,
    amendment_notes: 'Follow-on margin adjustments clarified for reduced-over matches in 2026.',
    sections: [
      { num: '13.1', title: 'Number of innings', exp: 'A match shall consist of one or two innings per side, as determined by the playing conditions.' },
      { num: '13.2', title: 'Alternate innings', exp: 'The sides shall take their innings alternately, except where the follow-on is enforced.' },
      { num: '13.3', title: 'Completed innings', exp: 'An innings is completed when the 10th wicket falls, the batting team is all out, or the captain declares.' },
      { num: '13.4', title: 'The follow-on', exp: 'In a 2-innings match, if the team that bats first leads by a sufficient margin (200 in 5-day, 150 in 3-day, 100 in 2-day, 75 in 1-day), they may require the other side to follow on.' }
    ]
  },
  {
    number: 14, title: 'Declaration and Forfeiture',
    category: 'Match Situations',
    short_description: 'Permits the batting captain to declare their innings closed or forfeit a future innings.',
    is_amended: false,
    sections: [
      { num: '14.1', title: 'Time of declaration', exp: 'The captain of the batting side may declare an innings closed at any time, even before the innings has begun.' },
      { num: '14.2', title: 'Forfeiture of an innings', exp: 'A captain may forfeit one of their team\'s innings by notifying the opposing captain and the umpires.' }
    ]
  },
  {
    number: 15, title: 'Scoring Runs',
    category: 'Batters',
    short_description: 'How runs are scored — by running, boundaries, extras and overthrows.',
    is_amended: true,
    amendment_notes: 'Overthrow boundary 6 rule clarified (runs scored by batter before the ball reaches the boundary) in 2026.',
    sections: [
      { num: '15.1', title: 'A run', exp: 'A run is scored when both batters run to the opposite ends and ground their bat or a part of their person behind the popping crease.' },
      { num: '15.2', title: 'Runs disallowed', exp: 'Runs shall not be scored if the batter is out or certain specific conditions apply such as the ball becoming dead.' },
      { num: '15.3', title: 'Short runs', exp: 'If a batter makes a short run, the umpire signals it and that run does not count.' },
      { num: '15.4', title: 'Overthrow or wilful act of fielder', exp: 'When the ball reaches the boundary following an overthrow, the number of runs scored is calculated from when the ball left the bat or a fielder last touched it.' }
    ]
  },
  {
    number: 16, title: 'Lost Ball',
    category: 'Match Situations',
    short_description: 'Procedures when the fielding side cannot recover the ball.',
    is_amended: false,
    sections: [
      { num: '16.1', title: 'Fielding side to call Lost ball', exp: 'If a ball in play cannot be found or recovered, the fielding side shall call "Lost ball."' },
      { num: '16.2', title: 'Runs scored', exp: 'When "Lost ball" is called, the batting side shall receive either the runs already completed or a minimum of 6 runs.' }
    ]
  },
  {
    number: 17, title: 'The Result',
    category: 'Match Situations',
    short_description: 'Defines win, loss, tie, draw, and abandoned match outcomes.',
    is_amended: false,
    sections: [
      { num: '17.1', title: 'A win', exp: 'A side wins if they score more runs than their opponents have scored in their completed innings.' },
      { num: '17.2', title: 'A tie', exp: 'The result is a tie when the scores are level and both sides have completed their innings.' },
      { num: '17.3', title: 'A draw', exp: 'A match is drawn if the result is not determined in the time available.' },
      { num: '17.4', title: 'Winning hit or extras', exp: 'As soon as the result is decided, the ball becomes dead. Any further activity by the fielding side is irrelevant to the result.' }
    ]
  },
  {
    number: 18, title: 'The Over',
    category: 'Bowlers',
    short_description: 'Defines an over — 6 legal deliveries — and when an over is complete.',
    is_amended: false,
    sections: [
      { num: '18.1', title: 'Number of balls', exp: 'An over consists of 6 legal balls bowled from one end of the pitch.' },
      { num: '18.2', title: 'Start of an over', exp: 'The umpire calls "Over" when the 6th legal delivery of an over has been completed.' },
      { num: '18.3', title: 'No ball or wide ball', exp: 'If a no ball or wide is bowled, it does not count as a legitimate ball for the purposes of the over.' }
    ]
  },
  {
    number: 19, title: 'Dead Ball',
    category: 'Match Situations',
    short_description: 'Defines the conditions under which the ball ceases to be in play.',
    is_amended: true,
    amendment_notes: 'Additional dead ball scenarios added in 2026 to address modern game situations.',
    sections: [
      { num: '19.1', title: 'Ball is dead', exp: 'The ball becomes dead when it is in the possession of the fielding side and the umpire is satisfied that the innings is in a stable state.' },
      { num: '19.2', title: 'Ball ceases to be dead', exp: 'The ball ceases to be dead when it comes into play — i.e., when the bowler starts their run-up.' },
      { num: '19.3', title: 'Call of dead ball', exp: 'The umpire shall call "Dead ball" in circumstances such as injury, unsatisfactory conditions, or when a batter is not ready.' }
    ]
  },
  {
    number: 20, title: 'No Ball',
    category: 'Bowlers',
    short_description: 'Defines the conditions that constitute a no ball — foot placement, height, dangerous deliveries, etc.',
    is_amended: true,
    amendment_notes: 'Beamer and head-height no-ball definitions clarified in 2026 edition.',
    sections: [
      { num: '20.1', title: 'Mode of delivery', exp: 'The bowler must deliver the ball with the arm above shoulder level. If not, the umpire shall call "No ball."' },
      { num: '20.2', title: 'Fair delivery – The feet', exp: 'The bowler\'s back foot must land within the return crease. The front foot must not be completely outside the popping crease.' },
      { num: '20.3', title: 'Bowler breaking wicket', exp: 'If a bowler breaks the wicket at the striker\'s end before completing the delivery, it is a no ball.' },
      { num: '20.4', title: 'Dangerous and unfair bowling', exp: 'A delivery aimed at the batter\'s head without ball bouncing, or excessive short-pitched deliveries, shall be called no ball.' },
      { num: '20.5', title: 'Fielder encroaching on pitch', exp: 'If a fielder is on the pitch before the ball is delivered, the delivery is a no ball.' },
      { num: '20.6', title: 'Penalty and runs from no ball', exp: 'A no ball counts 1 run (penalty) plus any runs scored by the batter. The batter cannot be out off a no ball except for run out, hit the ball twice, handled the ball or obstructing the field.' }
    ]
  },
  {
    number: 21, title: 'Wide Ball',
    category: 'Bowlers',
    short_description: 'Defines a wide ball — a delivery the batter is unable to reach — and its consequences.',
    is_amended: false,
    sections: [
      { num: '21.1', title: 'Judging a wide', exp: 'The umpire shall call "Wide ball" if the ball is bowled where in their opinion the batter did not have a reasonable opportunity to score.' },
      { num: '21.2', title: 'Delivery not a wide', exp: 'A delivery is not a wide if the batter makes contact with it or if it hits the striker\'s stumps.' },
      { num: '21.3', title: 'Penalty and runs from wide ball', exp: 'A wide counts 1 run (penalty) plus any byes run. The batter cannot be out off a wide except for run out, stumped, hit wicket or obstructing the field.' }
    ]
  },
  {
    number: 22, title: 'Byes and Leg Byes',
    category: 'Batters',
    short_description: 'Defines extras scored as byes (past the keeper) and leg byes (off the batter\'s body).',
    is_amended: false,
    sections: [
      { num: '22.1', title: 'Byes', exp: 'If a ball that is not a no ball or wide passes the striker without touching the bat or person, and runs are scored, these are byes.' },
      { num: '22.2', title: 'Leg byes', exp: 'If a ball hits any part of the striker\'s person except the hand holding the bat, and runs are scored, these are leg byes — provided the striker attempted to play or avoid the ball.' },
      { num: '22.3', title: 'Leg byes not to be awarded', exp: 'Leg byes shall not be awarded if neither a genuine stroke nor an attempt to avoid the ball was made.' }
    ]
  },
  {
    number: 23, title: 'Fielding the Ball',
    category: 'Fielders',
    short_description: 'Defines legal fielding and what constitutes unfair fielding — use of helmet, hats, etc.',
    is_amended: false,
    sections: [
      { num: '23.1', title: 'Fielding the ball', exp: 'The fielding side may use any part of their person to field the ball. Using any part of their clothing, cap or equipment is illegal.' },
      { num: '23.2', title: 'Limitations on the placement of fielders', exp: 'In limited-overs cricket, only certain numbers of fielders may be outside the fielding circle during specific overs.' },
      { num: '23.3', title: 'Unfair fielding', exp: 'Any deliberate distraction, interference or obstruction of the batter is unfair fielding and shall result in a penalty.' }
    ]
  },
  {
    number: 24, title: 'Scoring of Runs',
    category: 'Scorers',
    short_description: 'Detailed procedures for how runs are allocated — runs off the bat, extras, boundaries.',
    is_amended: false,
    sections: [
      { num: '24.1', title: 'Runs scored', exp: 'Runs shall be credited to the batting side from: runs off the bat, all extras, and penalty runs.' },
      { num: '24.2', title: 'Runs credited to the striker', exp: 'Runs from the bat are credited to the striker. Byes, leg byes and penalty runs do not count as the striker\'s personal score.' }
    ]
  },
  {
    number: 25, title: 'Result',
    category: 'Match Situations',
    short_description: 'Recording, verifying and finalising the match result — including DLS and VJD revised targets.',
    is_amended: true,
    amendment_notes: 'Rain interruption calculation method provisions clarified in 2026 edition.',
    sections: [
      { num: '25.1', title: 'Result', exp: 'The match result shall be agreed by the captains and umpires at the end of the match.' },
      { num: '25.2', title: 'Winning run', exp: 'As soon as the winning hit or bye is scored, the result is decided even if the ball has not been completed.' },
      { num: '25.3', title: 'Correctness of result', exp: 'The captains shall be jointly responsible for checking and agreeing the final scores before signing the scoresheets.' }
    ]
  },
  {
    number: 26, title: 'Practice on the Field',
    category: 'Match Situations',
    short_description: 'Rules for practice by either side on the field before and during a match.',
    is_amended: false,
    sections: [
      { num: '26.1', title: 'Practice on the field of play', exp: 'No practice may take place on the field of play during the match except under strictly limited conditions agreed by both captains and the umpires.' }
    ]
  },
  {
    number: 27, title: 'The Wicket is Down',
    category: 'Dismissals',
    short_description: 'Defines when the wicket is down — bail dislodged or stumps struck.',
    is_amended: false,
    sections: [
      { num: '27.1', title: 'Wicket put down', exp: 'The wicket is down if a bail is completely removed from the top of the stumps, or a stump is struck out of the ground by the ball, the batter\'s bat, or any part of the batter, bowler, or fielder.' },
      { num: '27.2', title: 'Bail falling before ball reaches wicket', exp: 'If a bail falls before the ball reaches the wicket (e.g., in wind), the ball must still dislodge a stump for a stumping or run-out to be completed.' }
    ]
  },
  {
    number: 28, title: 'Batters Absence; Retired Batter',
    category: 'Batters',
    short_description: 'Conditions under which a batter may retire and may or may not return.',
    is_amended: false,
    sections: [
      { num: '28.1', title: 'Absent batter', exp: 'If a batter is absent when their turn comes to bat, they are listed as "absent" and that wicket is not counted as fallen.' },
      { num: '28.2', title: 'Retired batter', exp: 'A batter may retire if injured or ill. They may return to bat later, subject to the opposing captain\'s consent.' }
    ]
  },
  {
    number: 29, title: 'The Fielder',
    category: 'Fielders',
    short_description: 'Conditions that define when a person is a fielder and the limits on fielding.',
    is_amended: false,
    sections: [
      { num: '29.1', title: 'When is a fielder?', exp: 'Each member of the fielding side is a fielder. A fielder is defined as such from the time they enter the playing area.' },
      { num: '29.2', title: 'Limitation on the number of on-side fielders', exp: 'At the moment of delivery, no more than 5 fielders may be on the on-side.' },
      { num: '29.3', title: 'Position of fielder', exp: 'A fielder must not stand at or near the wicket at the striker\'s end. They may not encroach on the pitch.' }
    ]
  },
  {
    number: 30, title: 'Batter Out of their Ground',
    category: 'Dismissals',
    short_description: 'Defines when a batter is "in their ground" and "out of their ground" — critical for run-outs and stumpings.',
    is_amended: true,
    amendment_notes: 'Clarification on ground when diving in 2026 edition.',
    sections: [
      { num: '30.1', title: 'When is a batter in their ground?', exp: 'A batter is in their ground if some part of their bat or person is grounded behind the popping crease at that end.' },
      { num: '30.2', title: 'A batter is out of their ground', exp: 'A batter is out of their ground if no part of their bat or person is grounded behind the popping crease.' }
    ]
  },
  {
    number: 31, title: 'Appeals',
    category: 'Umpires',
    short_description: 'The fielding side must appeal for a dismissal — "How\'s That?" — for a batter to be given out.',
    is_amended: false,
    sections: [
      { num: '31.1', title: 'Umpire not to give batter out without an appeal', exp: 'The umpire shall not give a batter out without an appeal being made by the fielding side.' },
      { num: '31.2', title: 'An appeal', exp: 'An appeal is a call of "How\'s That?" or any similar call to the umpire. Any member of the fielding side may appeal.' },
      { num: '31.3', title: 'Withdrawal of an appeal', exp: 'An appeal may only be withdrawn if the fielding captain withdraws it before the umpire has given a decision.' }
    ]
  },
  {
    number: 32, title: 'Bowled',
    category: 'Dismissals',
    short_description: 'A batter is out Bowled if the ball, delivered by the bowler, strikes the wicket.',
    is_amended: false,
    sections: [
      { num: '32.1', title: 'Out Bowled', exp: 'A batter is out Bowled if their wicket is put down by a ball delivered by the bowler, even if it first touched the bat or person of the batter.' },
      { num: '32.2', title: 'Bowled takes precedence', exp: 'If a batter could be given out both Bowled and LBW from the same ball, Bowled shall take precedence.' }
    ]
  },
  {
    number: 33, title: 'Timed Out',
    category: 'Dismissals',
    short_description: 'A new batter who takes more than 3 minutes to be ready to face a delivery may be given out Timed Out.',
    is_amended: false,
    sections: [
      { num: '33.1', title: 'Out Timed Out', exp: 'An incoming batter must be ready to face the next ball within 3 minutes of the outgoing batter being dismissed. Failure to do so may result in out Timed Out on appeal.' }
    ]
  },
  {
    number: 34, title: 'Hit the Ball Twice',
    category: 'Dismissals',
    short_description: 'A batter is out if they deliberately strike the ball a second time (except to guard their wicket).',
    is_amended: false,
    sections: [
      { num: '34.1', title: 'Out Hit the ball twice', exp: 'If a batter deliberately strikes the ball twice with the bat or any part of their person — except to protect the wicket — they are out Hit the ball twice.' },
      { num: '34.2', title: 'Returning the ball to a fielder', exp: 'The batter may return the ball to a fielder with the bat without penalty, as long as it is not done to gain advantage.' }
    ]
  },
  {
    number: 35, title: 'Hit Wicket',
    category: 'Dismissals',
    short_description: 'A batter is out Hit Wicket if they dislodge their wicket with bat or body while playing a shot or setting off for the first run.',
    is_amended: false,
    sections: [
      { num: '35.1', title: 'Out Hit Wicket', exp: 'A batter is out Hit Wicket if, while the ball is in play, they put down their own wicket with the bat or any part of their person while playing a stroke or setting off for a first run.' }
    ]
  },
  {
    number: 36, title: 'Leg Before Wicket',
    category: 'Dismissals',
    short_description: 'LBW — the complex Law defining when a ball intercepted by the batter\'s body would have hit the stumps.',
    is_amended: false,
    sections: [
      { num: '36.1', title: 'Out LBW', exp: 'A batter is out LBW if a ball pitched in line or on the off side of the stumps hits the batter\'s leg without the bat making contact first, and the ball would have hit the stumps, provided the batter was not playing a genuine stroke.' },
      { num: '36.2', title: 'Umpire\'s decision', exp: 'The umpire must be satisfied that: the ball pitched in line or on the off side; the ball would have hit the stumps; the point of impact was in line with the stumps; and the batter was not genuinely playing a stroke.' }
    ]
  },
  {
    number: 37, title: 'Obstructing the Field',
    category: 'Dismissals',
    short_description: 'A batter is out if they deliberately obstruct a fielder trying to effect a run-out or take a catch.',
    is_amended: true,
    amendment_notes: 'Updated in 2026 to incorporate handling the ball cases under Obstructing the Field.',
    sections: [
      { num: '37.1', title: 'Out Obstructing the field', exp: 'A batter is out if they wilfully obstruct the fielding side by actions or words. Obstructing a fielder taking a catch or effecting a run-out is included.' },
      { num: '37.2', title: 'Handling the ball', exp: 'From 2017 onwards, handling the ball (except at the request of a fielder) is covered under Obstructing the Field.' }
    ]
  },
  {
    number: 38, title: 'Run Out',
    category: 'Dismissals',
    short_description: 'A batter is run out if, while attempting a run, their wicket is put down while they are out of their ground.',
    is_amended: false,
    sections: [
      { num: '38.1', title: 'Out Run out', exp: 'A batter is out Run out if, at any time while the ball is in play, their wicket is put down by the fielding side and the batter is out of their ground.' },
      { num: '38.2', title: 'Diving for the crease', exp: 'A batter who dives is considered grounded if their bat or body is touching the ground behind the crease.' }
    ]
  },
  {
    number: 39, title: 'Stumped',
    category: 'Dismissals',
    short_description: 'A batter is out Stumped if the wicket-keeper puts down the wicket while the batter is out of their ground, not attempting a run.',
    is_amended: false,
    sections: [
      { num: '39.1', title: 'Out Stumped', exp: 'A batter is out Stumped if, in receiving the ball, they are out of their ground and the wicket-keeper breaks the wicket with the ball before the batter regains their ground.' },
      { num: '39.2', title: 'Ball rebounding from wicket-keeper', exp: 'The batter may be stumped from a ball that rebounds from the body of the wicket-keeper.' }
    ]
  },
  {
    number: 40, title: 'The Wicket-Keeper',
    category: 'Fielders',
    short_description: 'Rules governing the wicket-keeper\'s position, equipment (gloves and pads) and permissible actions.',
    is_amended: false,
    sections: [
      { num: '40.1', title: 'Protective equipment', exp: 'The wicket-keeper is the only fielder permitted to wear gloves and external leg guards.' },
      { num: '40.2', title: 'Position of wicket-keeper', exp: 'The wicket-keeper must stand behind the wicket on the side of the stumps opposite to the striker. They shall not move before the ball reaches the bat.' },
      { num: '40.3', title: 'Actions of the wicket-keeper', exp: 'Any action by the wicket-keeper that distract the striker, such as deliberate movement, is unfair and may be penalised.' }
    ]
  },
  {
    number: 41, title: 'The Fielder',
    category: 'Fielders',
    short_description: 'Comprehensive rules on permitted and prohibited actions by fielders during play.',
    is_amended: true,
    amendment_notes: 'Fielder conduct and placement rules updated for 2026 limited-overs formats.',
    sections: [
      { num: '41.1', title: 'Protective equipment', exp: 'No fielder except the wicket-keeper may use any external protective equipment. Helmets and shin-guards may be worn.' },
      { num: '41.2', title: 'Damaging the pitch', exp: 'A fielder must not deliberately damage the pitch. The umpires may move a fielder away from the protected pitch area.' },
      { num: '41.3', title: 'Moving following the striker\'s head', exp: 'A fielder may not make deliberate movement while the bowler is running in to bowl to distract the striker.' },
      { num: '41.4', title: 'Fielder\'s helmet on the ground', exp: 'No fielder shall place a fielding helmet or cap on the ground within the field of play during play.' }
    ]
  },
  {
    number: 42, title: 'Fair and Unfair Play',
    category: 'Match Officials',
    short_description: 'The overarching Law governing the spirit of cricket and what constitutes unfair play.',
    is_amended: true,
    amendment_notes: 'Major updates in 2026 on ball-tampering, fake fielding, deliberate time-wasting and Spirit of Cricket provisions.',
    sections: [
      { num: '42.1', title: 'Fair and unfair play', exp: 'Cricket is to be played in a spirit of fair play. The umpires are the sole judges of fair and unfair play on the field.' },
      { num: '42.2', title: 'Responsibility of captains', exp: 'The captains are responsible for ensuring that play is conducted within the spirit and laws of cricket at all times.' },
      { num: '42.3', title: 'Deliberate distraction', exp: 'Any deliberate distraction, deception or obstruction of the striker or non-striker by the fielding side is unfair play.' },
      { num: '42.4', title: 'Dangerous and unfair bowling', exp: 'The bowling of short-pitched balls or full tosses aimed at the batter\'s body or head is unfair.' },
      { num: '42.5', title: 'Fake fielding', exp: 'A fielder may not pretend to field the ball to deceive a batter into not running. This is deliberate deception and unfair play.' },
      { num: '42.6', title: 'Ball tampering', exp: 'Any deliberate attempt to alter the condition of the ball beyond what is permitted is illegal and unfair.' },
      { num: '42.7', title: 'Time wasting', exp: 'Deliberate time wasting by the fielding or batting side is unfair. Umpires may award 5 penalty runs.' }
    ]
  }
];

// ─────────────────────────────────────────────────────────────────────────────
// Seed Function
// ─────────────────────────────────────────────────────────────────────────────

async function seedCricketLaws() {
  try {
    await db.initDb();
    const { CricketLaw, CricketLawSection, CricketLawVersion } = db.models;

    const existingCount = await CricketLaw.countDocuments();
    if (existingCount >= 42) {
      console.log(`✅ Cricket Laws already seeded (${existingCount} laws found). Skipping.`);
      process.exit(0);
      return;
    }

    console.log('🏏 Seeding MCC Cricket Laws 2017 Code – Fourth Edition 2026...\n');

    let lawsCreated = 0;
    let sectionsCreated = 0;

    for (const lawData of LAWS_DATA) {
      const lawId = genId('LAW');
      const timestamp = new Date();

      // Check if law already exists
      const existing = await CricketLaw.findOne({ law_number: lawData.number });
      if (existing) {
        console.log(`  ⏭️  Law ${lawData.number} already exists, skipping`);
        continue;
      }

      // Create the law
      await CricketLaw.create({
        id: lawId,
        law_number: lawData.number,
        title: lawData.title,
        short_description: lawData.short_description,
        category: lawData.category,
        edition: '2017 Code – Fourth Edition 2026',
        effective_date: '1 October 2026',
        source_url: 'https://lawsofcricket.lords.org/',
        is_amended_2026: lawData.is_amended || false,
        amendment_notes: lawData.amendment_notes || '',
        subsection_count: lawData.sections ? lawData.sections.length : 0,
        display_order: lawData.number,
        is_active: true,
        last_verified_at: timestamp
      });

      // Create version record
      await CricketLawVersion.create({
        id: genId('VER'),
        law_id: lawId,
        law_number: lawData.number,
        edition: '2017 Code – Fourth Edition 2026',
        amendment_notes: lawData.amendment_notes || 'Original 2026 edition seeded.',
        effective_date: '1 October 2026',
        is_current: true
      });

      lawsCreated++;

      // Create sections
      if (lawData.sections && lawData.sections.length > 0) {
        for (let i = 0; i < lawData.sections.length; i++) {
          const sec = lawData.sections[i];
          await CricketLawSection.create({
            id: genId('SEC'),
            law_id: lawId,
            law_number: lawData.number,
            section_number: sec.num,
            section_title: sec.title,
            explanation: sec.exp || '',
            detailed_explanation: sec.detailed || '',
            practical_example: sec.example || '',
            parent_section_id: null,
            depth: 1,
            display_order: i + 1,
            is_active: true
          });
          sectionsCreated++;
        }
      }

      console.log(`  ✅ Law ${lawData.number}: ${lawData.title} — ${lawData.sections ? lawData.sections.length : 0} sections`);
    }

    console.log(`\n🎉 Cricket Laws Seeding Complete!`);
    console.log(`   Laws created: ${lawsCreated}`);
    console.log(`   Sections created: ${sectionsCreated}`);
    console.log(`   Edition: MCC 2017 Code – Fourth Edition 2026`);
    console.log(`   Effective: 1 October 2026`);
    console.log(`   Source: https://lawsofcricket.lords.org/`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding error:', err.message);
    process.exit(1);
  }
}

seedCricketLaws();
