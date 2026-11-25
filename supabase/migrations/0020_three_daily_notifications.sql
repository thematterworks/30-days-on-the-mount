-- Three a day (app/api/cron/daily-push, midday, evening-checkin).
--
-- Morning: the day's theme and one honest question, opening the day.
-- Midday: one phrase of the scripture brought close, opening "Going deeper"
--         — app notification only; the SMS program stays at two a day, as
--         its registered message frequency says.
-- Evening: how the practice went, opening the companion (and, for SMS
--          participants, the evening text itself).
alter table curriculum_days
  add column if not exists morning_push_text text not null default '',
  add column if not exists midday_push_text text not null default '';

comment on column curriculum_days.morning_push_text is
  'Body of the morning app notification for this day. Blank falls back to hook_text.';
comment on column curriculum_days.midday_push_text is
  'Body of the midday app notification ("Going deeper"). App only, never texted. Blank skips the midday notification for this day.';

alter table users
  add column if not exists midday_sent_on date,
  add column if not exists midday_invitations boolean not null default true;

comment on column users.midday_sent_on is 'Local date of the last midday notification, so it goes at most once a day.';
comment on column users.midday_invitations is 'Whether this participant wants the midday notification (Profile → Notifications).';

-- First drafts, for review in admin. Only blank fields are filled, so
-- anything already edited there is kept.

update curriculum_days set
  morning_push_text = case when morning_push_text = '' then $$What would it feel like to stop defending yourself today?$$ else morning_push_text end,
  midday_push_text = case when midday_push_text = '' then $$Jesus didn't say "blessed are the humble." He chose a word for a beggar with empty hands. Sit with that for three minutes.$$ else midday_push_text end,
  evening_prompt_text = case when coalesce(evening_prompt_text, '') = '' then $$How did it go, letting go of being right today? Tell me where it got hard.$$ else evening_prompt_text end
where day_number = 1;

update curriculum_days set
  morning_push_text = case when morning_push_text = '' then $$Whose grief could you simply sit beside today, without fixing it?$$ else morning_push_text end,
  midday_push_text = case when midday_push_text = '' then $$"Blessed are those who mourn." Jesus calls the grieving blessed, not the cheerful. Read slowly: what is He saying about comfort?$$ else midday_push_text end,
  evening_prompt_text = case when coalesce(evening_prompt_text, '') = '' then $$Did you manage to sit with someone's pain without fixing it? What did that silence feel like?$$ else evening_prompt_text end
where day_number = 2;

update curriculum_days set
  morning_push_text = case when morning_push_text = '' then $$Could you give something up today and let no one know you did?$$ else morning_push_text end,
  midday_push_text = case when midday_push_text = '' then $$Meekness isn't weakness. It's strength that doesn't need to be seen. Go deeper into what it means to inherit the earth.$$ else midday_push_text end,
  evening_prompt_text = case when coalesce(evening_prompt_text, '') = '' then $$What did you yield today, and did anyone notice? How did it feel to stay hidden?$$ else evening_prompt_text end
where day_number = 3;

update curriculum_days set
  morning_push_text = case when morning_push_text = '' then $$What are you really feeding on when you reach for your phone?$$ else morning_push_text end,
  midday_push_text = case when midday_push_text = '' then $$Jesus names the body's most urgent needs, hunger and thirst, and points them at righteousness. Take a few minutes with that.$$ else midday_push_text end,
  evening_prompt_text = case when coalesce(evening_prompt_text, '') = '' then $$How was the quiet without your screens? What surfaced when the noise was gone?$$ else evening_prompt_text end
where day_number = 4;

update curriculum_days set
  morning_push_text = case when morning_push_text = '' then $$Who owes you something you could let go of today?$$ else morning_push_text end,
  midday_push_text = case when midday_push_text = '' then $$In Jesus' world, mercy wasn't a feeling. It was a debt cancelled. Read on: why do the merciful receive mercy?$$ else midday_push_text end,
  evening_prompt_text = case when coalesce(evening_prompt_text, '') = '' then $$Did you cancel the debt in your heart? Has it tried to come back?$$ else evening_prompt_text end
where day_number = 5;

update curriculum_days set
  morning_push_text = case when morning_push_text = '' then $$Who are you really performing for?$$ else morning_push_text end,
  midday_push_text = case when midday_push_text = '' then $$A pure heart is an undivided one: one motive, not two. Spend a few minutes with what it means to see God.$$ else midday_push_text end,
  evening_prompt_text = case when coalesce(evening_prompt_text, '') = '' then $$Did you name your hidden motive to someone? What was it like to be seen?$$ else evening_prompt_text end
where day_number = 6;

update curriculum_days set
  morning_push_text = case when morning_push_text = '' then $$Is there a door you've been waiting for someone else to open?$$ else morning_push_text end,
  midday_push_text = case when midday_push_text = '' then $$Jesus blesses peacemakers, not peacekeepers. Peace like His is made, not kept. Go deeper into what He means.$$ else midday_push_text end,
  evening_prompt_text = case when coalesce(evening_prompt_text, '') = '' then $$Did you reach out to repair something today? How did it go?$$ else evening_prompt_text end
where day_number = 7;

update curriculum_days set
  morning_push_text = case when morning_push_text = '' then $$How often does your inner courtroom open in a day? Count today.$$ else morning_push_text end,
  midday_push_text = case when midday_push_text = '' then $$Jesus takes the command against murder and traces it back to contempt in the heart. Read it slowly with Him.$$ else midday_push_text end,
  evening_prompt_text = case when coalesce(evening_prompt_text, '') = '' then $$How many times did you drop the gavel today? Who kept ending up on trial?$$ else evening_prompt_text end
where day_number = 8;

update curriculum_days set
  morning_push_text = case when morning_push_text = '' then $$What if every face you passed today carried the image of God?$$ else morning_push_text end,
  midday_push_text = case when midday_push_text = '' then $$Jesus moves from the act to the look. Read what He says about the eyes and the heart.$$ else midday_push_text end,
  evening_prompt_text = case when coalesce(evening_prompt_text, '') = '' then $$Who did you really see today? Did anyone surprise you?$$ else evening_prompt_text end
where day_number = 9;

update curriculum_days set
  morning_push_text = case when morning_push_text = '' then $$Could you go one whole day with no excuses at all?$$ else morning_push_text end,
  midday_push_text = case when midday_push_text = '' then $$"Let your 'Yes' be 'Yes.'" Jesus wants words that need no oath to hold them up. Spend a few minutes there.$$ else midday_push_text end,
  evening_prompt_text = case when coalesce(evening_prompt_text, '') = '' then $$How many small excuses did you catch yourself reaching for? What did plain honesty cost you?$$ else evening_prompt_text end
where day_number = 10;

update curriculum_days set
  morning_push_text = case when morning_push_text = '' then $$When someone wrongs you today, what will you do with the blow?$$ else morning_push_text end,
  midday_push_text = case when midday_push_text = '' then $$Turning the other cheek wasn't weakness in Jesus' world. Go deeper into what He was actually asking.$$ else midday_push_text end,
  evening_prompt_text = case when coalesce(evening_prompt_text, '') = '' then $$Did someone wrong you today? What happened when you didn't hit back?$$ else evening_prompt_text end
where day_number = 11;

update curriculum_days set
  morning_push_text = case when morning_push_text = '' then $$What would it look like to do twice what's asked of you today, gladly?$$ else morning_push_text end,
  midday_push_text = case when midday_push_text = '' then $$A Roman soldier could force a civilian to carry his pack one mile. Jesus said: go two. Read why.$$ else midday_push_text end,
  evening_prompt_text = case when coalesce(evening_prompt_text, '') = '' then $$Where did you go the second mile today? Did it feel like freedom or burden?$$ else evening_prompt_text end
where day_number = 12;

update curriculum_days set
  morning_push_text = case when morning_push_text = '' then $$Who is the hardest person for you to pray for?$$ else morning_push_text end,
  midday_push_text = case when midday_push_text = '' then $$Jesus doesn't say tolerate your enemies. He says love them, and pray for them. Spend some time with why.$$ else midday_push_text end,
  evening_prompt_text = case when coalesce(evening_prompt_text, '') = '' then $$What happened when you prayed for that person? Did anything shift in you?$$ else evening_prompt_text end
where day_number = 13;

update curriculum_days set
  morning_push_text = case when morning_push_text = '' then $$Could you give something away today that no one ever finds out about?$$ else morning_push_text end,
  midday_push_text = case when midday_push_text = '' then $$"Do not let your left hand know what your right hand is doing." Read slowly. Who is your giving really for?$$ else midday_push_text end,
  evening_prompt_text = case when coalesce(evening_prompt_text, '') = '' then $$Did you give in secret? What was it like to have no one to tell?$$ else evening_prompt_text end
where day_number = 14;

update curriculum_days set
  morning_push_text = case when morning_push_text = '' then $$Can you find twenty minutes of true silence today?$$ else morning_push_text end,
  midday_push_text = case when midday_push_text = '' then $$Jesus sends us into the inner room and shuts the door behind us. Go deeper into what waits there.$$ else midday_push_text end,
  evening_prompt_text = case when coalesce(evening_prompt_text, '') = '' then $$What happened in the silence? What came up when nothing else was there?$$ else evening_prompt_text end
where day_number = 15;

update curriculum_days set
  morning_push_text = case when morning_push_text = '' then $$What changes when "I" becomes "we" in your prayers?$$ else morning_push_text end,
  midday_push_text = case when midday_push_text = '' then $$The prayer Jesus taught never says "I" or "my." Every line is "our" and "us." Read it again, slowly.$$ else midday_push_text end,
  evening_prompt_text = case when coalesce(evening_prompt_text, '') = '' then $$How did it feel to pray only as "we" today? Who came to mind?$$ else evening_prompt_text end
where day_number = 16;

update curriculum_days set
  morning_push_text = case when morning_push_text = '' then $$What comfort could you give up today without anyone knowing?$$ else morning_push_text end,
  midday_push_text = case when midday_push_text = '' then $$Jesus says to wash your face when you fast, so no one can tell. Spend a few minutes on why.$$ else midday_push_text end,
  evening_prompt_text = case when coalesce(evening_prompt_text, '') = '' then $$Did you keep your fast hidden? Was it harder to go without, or to keep quiet about it?$$ else evening_prompt_text end
where day_number = 17;

update curriculum_days set
  morning_push_text = case when morning_push_text = '' then $$What do you own that you'd find hard to give away?$$ else morning_push_text end,
  midday_push_text = case when midday_push_text = '' then $$"For where your treasure is, there your heart will be also." The heart follows the treasure. Read it slowly.$$ else midday_push_text end,
  evening_prompt_text = case when coalesce(evening_prompt_text, '') = '' then $$What did you give away today? Does your heart feel lighter or heavier?$$ else evening_prompt_text end
where day_number = 18;

update curriculum_days set
  morning_push_text = case when morning_push_text = '' then $$What beauty have you stopped noticing?$$ else morning_push_text end,
  midday_push_text = case when midday_push_text = '' then $$Jesus calls the eye the lamp of the body. A healthy eye fills the whole body with light. Go deeper.$$ else midday_push_text end,
  evening_prompt_text = case when coalesce(evening_prompt_text, '') = '' then $$What did you see on your walk today that you'd stopped noticing?$$ else evening_prompt_text end
where day_number = 19;

update curriculum_days set
  morning_push_text = case when morning_push_text = '' then $$What are you most anxious about tomorrow?$$ else morning_push_text end,
  midday_push_text = case when midday_push_text = '' then $$"Consider how the lilies of the field grow." Jesus makes flowers and birds our teachers. Spend a few minutes with them.$$ else midday_push_text end,
  evening_prompt_text = case when coalesce(evening_prompt_text, '') = '' then $$How many worries did you catch today? Which one was hardest to let go?$$ else evening_prompt_text end
where day_number = 20;

update curriculum_days set
  morning_push_text = case when morning_push_text = '' then $$What would it take for you to truly stop today?$$ else morning_push_text end,
  midday_push_text = case when midday_push_text = '' then $$"Come to Me, all you who are weary and burdened, and I will give you rest." Read it slowly. It's an invitation.$$ else midday_push_text end,
  evening_prompt_text = case when coalesce(evening_prompt_text, '') = '' then $$Were you able to rest today? What did your mind do when you stopped producing?$$ else evening_prompt_text end
where day_number = 21;

update curriculum_days set
  morning_push_text = case when morning_push_text = '' then $$Whose flaw is easiest for you to see?$$ else morning_push_text end,
  midday_push_text = case when midday_push_text = '' then $$Jesus paints an almost comic picture: a log in your own eye while you hunt for a speck in someone else's. Go deeper.$$ else midday_push_text end,
  evening_prompt_text = case when coalesce(evening_prompt_text, '') = '' then $$When you caught yourself judging today, what did you find in the mirror?$$ else evening_prompt_text end
where day_number = 22;

update curriculum_days set
  morning_push_text = case when morning_push_text = '' then $$Where are you trying too hard to convince someone?$$ else morning_push_text end,
  midday_push_text = case when midday_push_text = '' then $$One of Jesus' strangest sayings: don't throw your pearls before swine. Spend a few minutes on what He meant.$$ else midday_push_text end,
  evening_prompt_text = case when coalesce(evening_prompt_text, '') = '' then $$Did you let go of an argument today? What was it like not to need to win?$$ else evening_prompt_text end
where day_number = 23;

update curriculum_days set
  morning_push_text = case when morning_push_text = '' then $$What are you trying to control that you could simply ask for?$$ else morning_push_text end,
  midday_push_text = case when midday_push_text = '' then $$Ask, seek, knock. In the Greek, each is ongoing: keep asking, keep seeking, keep knocking. Read on.$$ else midday_push_text end,
  evening_prompt_text = case when coalesce(evening_prompt_text, '') = '' then $$What did you hand over to the Father today? How hard was it to stop striving?$$ else evening_prompt_text end
where day_number = 24;

update curriculum_days set
  morning_push_text = case when morning_push_text = '' then $$How do you most wish someone would treat you right now?$$ else morning_push_text end,
  midday_push_text = case when midday_push_text = '' then $$"Do to others as you would have them do to you." Jesus says this sums up the Law and the Prophets. Go deeper.$$ else midday_push_text end,
  evening_prompt_text = case when coalesce(evening_prompt_text, '') = '' then $$Who did you show up for today the way you wish someone would show up for you?$$ else evening_prompt_text end
where day_number = 25;

update curriculum_days set
  morning_push_text = case when morning_push_text = '' then $$What do you reach for when you don't want to feel something?$$ else morning_push_text end,
  midday_push_text = case when midday_push_text = '' then $$Jesus describes a wide road and a narrow gate. Read slowly: what makes the narrow way narrow?$$ else midday_push_text end,
  evening_prompt_text = case when coalesce(evening_prompt_text, '') = '' then $$What happened when you set your usual comfort aside today? What were you avoiding feeling?$$ else evening_prompt_text end
where day_number = 26;

update curriculum_days set
  morning_push_text = case when morning_push_text = '' then $$If someone only saw your last week, what would they say you value?$$ else morning_push_text end,
  midday_push_text = case when midday_push_text = '' then $$"By their fruit you will recognize them." Jesus looks past labels to what a life actually grows. Spend time there.$$ else midday_push_text end,
  evening_prompt_text = case when coalesce(evening_prompt_text, '') = '' then $$What did honestly looking at your fruit show you today? Was anything hard to write down?$$ else evening_prompt_text end
where day_number = 27;

update curriculum_days set
  morning_push_text = case when morning_push_text = '' then $$Can you spend today with nothing at all to accomplish?$$ else morning_push_text end,
  midday_push_text = case when midday_push_text = '' then $$"Take My yoke upon you and learn from Me, for I am gentle and humble in heart." Notice how Jesus describes Himself.$$ else midday_push_text end,
  evening_prompt_text = case when coalesce(evening_prompt_text, '') = '' then $$How was this second day of rest compared with the first? What's changed in you?$$ else evening_prompt_text end
where day_number = 28;

update curriculum_days set
  morning_push_text = case when morning_push_text = '' then $$Looking back over these weeks, what has lost its grip on you?$$ else morning_push_text end,
  midday_push_text = case when midday_push_text = '' then $$The crowds were amazed because Jesus taught as one with authority. Go deeper: what gave His words that weight?$$ else midday_push_text end,
  evening_prompt_text = case when coalesce(evening_prompt_text, '') = '' then $$What did you name today that's lost its power over you? Who did you tell?$$ else evening_prompt_text end
where day_number = 29;

update curriculum_days set
  morning_push_text = case when morning_push_text = '' then $$Which practice from this journey scared you the most?$$ else morning_push_text end,
  midday_push_text = case when midday_push_text = '' then $$The house on the rock and the house on the sand both faced the same storm. Jesus says the difference is doing. Read on.$$ else midday_push_text end,
  evening_prompt_text = case when coalesce(evening_prompt_text, '') = '' then $$Which practice did you choose to keep, and how did it go today?$$ else evening_prompt_text end
where day_number = 30;

update curriculum_days set
  morning_push_text = case when morning_push_text = '' then $$What does it feel like to be made new?$$ else morning_push_text end,
  midday_push_text = case when midday_push_text = '' then $$"If anyone is in Christ, he is a new creation." Read it slowly. This is where the journey keeps going.$$ else midday_push_text end,
  evening_prompt_text = case when coalesce(evening_prompt_text, '') = '' then $$What did love feel like with your ego out of the way? Who will you invite into this way of living?$$ else evening_prompt_text end
where day_number = 31;
