-- Création de la table consultations pour le calendrier
CREATE TABLE IF NOT EXISTS consultations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_name TEXT,
  patient_email TEXT,
  patient_phone TEXT,
  date DATE NOT NULL,
  time TIME NOT NULL,
  type TEXT DEFAULT 'consultation',
  status TEXT DEFAULT 'pending' CHECK (status IN ('confirmed', 'pending', 'cancelled')),
  notes TEXT,
  duration INTEGER DEFAULT 60, -- durée en minutes
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_consultations_date ON consultations(date);
CREATE INDEX IF NOT EXISTS idx_consultations_user_id ON consultations(user_id);
CREATE INDEX IF NOT EXISTS idx_consultations_status ON consultations(status);

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_consultations_updated_at 
    BEFORE UPDATE ON consultations 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Politique RLS (Row Level Security) pour la sécurité
ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;

-- Politique pour permettre aux utilisateurs de voir leurs propres consultations
CREATE POLICY "Users can view their own consultations" ON consultations
  FOR SELECT USING (auth.uid() = user_id);

-- Politique pour permettre aux utilisateurs de créer leurs propres consultations
CREATE POLICY "Users can create their own consultations" ON consultations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Politique pour permettre aux utilisateurs de modifier leurs propres consultations
CREATE POLICY "Users can update their own consultations" ON consultations
  FOR UPDATE USING (auth.uid() = user_id);

-- Politique pour permettre aux utilisateurs de supprimer leurs propres consultations
CREATE POLICY "Users can delete their own consultations" ON consultations
  FOR DELETE USING (auth.uid() = user_id);

-- Politique spéciale pour les admins (basée sur l'email)
CREATE POLICY "Admins can view all consultations" ON consultations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.email IN ('cardiomaxmo@gmail.com', 'admin@coquillage.fr')
    )
  );

CREATE POLICY "Admins can create consultations" ON consultations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.email IN ('cardiomaxmo@gmail.com', 'admin@coquillage.fr')
    )
  );

CREATE POLICY "Admins can update consultations" ON consultations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.email IN ('cardiomaxmo@gmail.com', 'admin@coquillage.fr')
    )
  );

CREATE POLICY "Admins can delete consultations" ON consultations
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.email IN ('cardiomaxmo@gmail.com', 'admin@coquillage.fr')
    )
  ); 