-- Insertion de données de test pour le calendrier
-- Ces données permettront de tester l'interface admin

INSERT INTO consultations (
  patient_name,
  patient_email,
  patient_phone,
  date,
  time,
  type,
  status,
  notes,
  duration,
  created_at
) VALUES 
-- Rendez-vous pour aujourd'hui
(
  'Marie Dupont',
  'marie.dupont@email.com',
  '0698765432',
  CURRENT_DATE,
  '09:00:00',
  'consultation',
  'confirmed',
  'Première consultation - Suivi nutritionnel',
  60,
  NOW()
),
(
  'Jean Martin',
  'jean.martin@email.com',
  '0612345678',
  CURRENT_DATE,
  '10:30:00',
  'suivi',
  'confirmed',
  'Contrôle mensuel - Régime équilibré',
  45,
  NOW()
),
(
  'Sophie Bernard',
  'sophie.bernard@email.com',
  '0654321987',
  CURRENT_DATE,
  '14:00:00',
  'consultation',
  'pending',
  'Nouveau patient - Problèmes digestifs',
  60,
  NOW()
),

-- Rendez-vous pour demain
(
  'Pierre Durand',
  'pierre.durand@email.com',
  '0687654321',
  CURRENT_DATE + INTERVAL '1 day',
  '08:30:00',
  'urgence',
  'confirmed',
  'Consultation urgente - Allergie alimentaire',
  30,
  NOW()
),
(
  'Claire Moreau',
  'claire.moreau@email.com',
  '0643219876',
  CURRENT_DATE + INTERVAL '1 day',
  '11:00:00',
  'suivi',
  'confirmed',
  'Suivi perte de poids - Objectif atteint',
  45,
  NOW()
),

-- Rendez-vous pour la semaine prochaine
(
  'Lucas Petit',
  'lucas.petit@email.com',
  '0676543219',
  CURRENT_DATE + INTERVAL '7 days',
  '09:00:00',
  'consultation',
  'pending',
  'Consultation sportif - Nutrition performance',
  60,
  NOW()
),
(
  'Emma Roux',
  'emma.roux@email.com',
  '0698765432',
  CURRENT_DATE + INTERVAL '7 days',
  '15:30:00',
  'suivi',
  'confirmed',
  'Contrôle trimestriel - Régime végétarien',
  45,
  NOW()
),

-- Rendez-vous pour le mois prochain
(
  'Thomas Leroy',
  'thomas.leroy@email.com',
  '0612345678',
  CURRENT_DATE + INTERVAL '30 days',
  '10:00:00',
  'consultation',
  'pending',
  'Nouveau patient - Diabète type 2',
  60,
  NOW()
),
(
  'Julie Simon',
  'julie.simon@email.com',
  '0654321987',
  CURRENT_DATE + INTERVAL '30 days',
  '14:30:00',
  'suivi',
  'confirmed',
  'Suivi grossesse - Nutrition prénatale',
  45,
  NOW()
); 