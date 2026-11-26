-- The threshold: the few breaths before a day's story. A short headline
-- and one gentle line for each day, inviting the reader to slow down and
-- be present with God; written for people new to the text. Edited in the
-- admin (curriculum day dialog). Fills only blank fields.
alter table curriculum_days
  add column if not exists threshold_title text not null default '',
  add column if not exists threshold_line text not null default '';

update curriculum_days set threshold_title = 'Come as you are', threshold_line = 'You don''t need to bring anything. Breathe, and let God meet you here.' where day_number = 1 and threshold_title = '';
update curriculum_days set threshold_title = 'Bring what''s heavy', threshold_line = 'Whatever you''re grieving, you can set it down for a moment. You''re not alone in it.' where day_number = 2 and threshold_title = '';
update curriculum_days set threshold_title = 'Soften your grip', threshold_line = 'Unclench your hands, your jaw, your shoulders. Let the Spirit steady you.' where day_number = 3 and threshold_title = '';
update curriculum_days set threshold_title = 'What are you hungry for?', threshold_line = 'Notice the ache beneath the busyness, and ask God to fill it.' where day_number = 4 and threshold_title = '';
update curriculum_days set threshold_title = 'Receive mercy first', threshold_line = 'Breathe in the mercy that holds you. Breathe out the grudge you''ve been carrying.' where day_number = 5 and threshold_title = '';
update curriculum_days set threshold_title = 'Clear a little space', threshold_line = 'Let the noise settle. A quiet heart sees more of God.' where day_number = 6 and threshold_title = '';
update curriculum_days set threshold_title = 'Peace begins here', threshold_line = 'Before you make peace with anyone else, let the Spirit make peace in you.' where day_number = 7 and threshold_title = '';
update curriculum_days set threshold_title = 'Notice your anger', threshold_line = 'No judgment, only honesty. Hold it gently in God''s light.' where day_number = 8 and threshold_title = '';
update curriculum_days set threshold_title = 'See with kinder eyes', threshold_line = 'Ask the Spirit to help you see people as people, starting today.' where day_number = 9 and threshold_title = '';
update curriculum_days set threshold_title = 'No performance needed', threshold_line = 'You don''t have to impress anyone here. Simply be honest with God.' where day_number = 10 and threshold_title = '';
update curriculum_days set threshold_title = 'Lay down the score', threshold_line = 'Whatever you''ve been keeping count of, put it down for these few minutes.' where day_number = 11 and threshold_title = '';
update curriculum_days set threshold_title = 'Make room for more', threshold_line = 'Ask for a heart that goes further than it has to.' where day_number = 12 and threshold_title = '';
update curriculum_days set threshold_title = 'Bring someone to mind', threshold_line = 'Someone hard to love. You don''t have to feel warm yet. Just hold them before God.' where day_number = 13 and threshold_title = '';
update curriculum_days set threshold_title = 'No one is watching', threshold_line = 'This time is just between you and God. That''s the gift of it.' where day_number = 14 and threshold_title = '';
update curriculum_days set threshold_title = 'Close the door', threshold_line = 'Jesus said to go into your room and pray in secret. For the next few minutes, this is that room.' where day_number = 15 and threshold_title = '';
update curriculum_days set threshold_title = 'You are someone''s child', threshold_line = 'Begin where Jesus began, with "Our Father," and let that be enough.' where day_number = 16 and threshold_title = '';
update curriculum_days set threshold_title = 'Set something down', threshold_line = 'Your phone, your plans, your appetite. Even for a moment, make room.' where day_number = 17 and threshold_title = '';
update curriculum_days set threshold_title = 'Where is your heart?', threshold_line = 'Breathe slowly, and notice what you''ve been holding most tightly.' where day_number = 18 and threshold_title = '';
update curriculum_days set threshold_title = 'Let the light in', threshold_line = 'Turn toward God the way you''d turn your face to the morning sun.' where day_number = 19 and threshold_title = '';
update curriculum_days set threshold_title = 'Consider the lilies', threshold_line = 'Nothing is required of you right now. Be held, the way the flowers are.' where day_number = 20 and threshold_title = '';
update curriculum_days set threshold_title = 'Rest is holy', threshold_line = 'You don''t have to earn this. Stop, and simply be with God.' where day_number = 21 and threshold_title = '';
update curriculum_days set threshold_title = 'Look gently inward', threshold_line = 'Before judging anyone else, let the Spirit show you yourself, kindly.' where day_number = 22 and threshold_title = '';
update curriculum_days set threshold_title = 'Guard what''s sacred', threshold_line = 'Some things are precious. Bring them here, where they''re safe.' where day_number = 23 and threshold_title = '';
update curriculum_days set threshold_title = 'Ask', threshold_line = 'What do you need today? Say it plainly. Your Father is listening.' where day_number = 24 and threshold_title = '';
update curriculum_days set threshold_title = 'Receive what you''d give', threshold_line = 'Breathe in the kindness you hope to show others today.' where day_number = 25 and threshold_title = '';
update curriculum_days set threshold_title = 'One step at a time', threshold_line = 'The narrow way is walked one breath at a time. Take this one.' where day_number = 26 and threshold_title = '';
update curriculum_days set threshold_title = 'What is growing in you?', threshold_line = 'Be still, and notice the quiet ways the Spirit is changing you.' where day_number = 27 and threshold_title = '';
update curriculum_days set threshold_title = 'Come back to rest', threshold_line = 'Return to stillness. It''s still here, and so is God.' where day_number = 28 and threshold_title = '';
update curriculum_days set threshold_title = 'Gather it up', threshold_line = 'Bring everything these days have stirred, and let God hold it together.' where day_number = 29 and threshold_title = '';
update curriculum_days set threshold_title = 'Stand on solid ground', threshold_line = 'Breathe deep. You''re building on something that holds.' where day_number = 30 and threshold_title = '';
update curriculum_days set threshold_title = 'This is only the beginning', threshold_line = 'The life Jesus offers goes on from here. Breathe it in.' where day_number = 31 and threshold_title = '';
