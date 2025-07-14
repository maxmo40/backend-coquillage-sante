const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration conditionnelle des services
let supabase;
let stripe;

// Configuration Supabase conditionnelle
if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
  const { createClient } = require('@supabase/supabase-js');
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  console.log('✅ Supabase configuré');
} else {
  console.warn('⚠️  Variables Supabase non définies - La base de données sera désactivée');
}

// Configuration Stripe conditionnelle
if (process.env.STRIPE_SECRET_KEY) {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  console.log('✅ Stripe configuré');
} else {
  console.warn('⚠️  STRIPE_SECRET_KEY non définie - Les paiements seront désactivés');
}

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:8080',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes de base
app.get('/', (req, res) => {
  res.json({ 
    message: 'API Coquillage Santé - Backend opérationnel',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      users: '/api/users',
      consultations: '/api/consultations',
      payments: '/api/payments'
    }
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    services: {
      supabase: !!supabase,
      stripe: !!stripe
    }
  });
});

// ===== API UTILISATEURS =====
app.get('/api/users', async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ 
      error: 'Base de données non configurée',
      message: 'Supabase n\'est pas configuré sur ce serveur'
    });
  }
  
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*');
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/users', async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ 
      error: 'Base de données non configurée',
      message: 'Supabase n\'est pas configuré sur ce serveur'
    });
  }
  
  try {
    const { email, name, phone } = req.body;
    
    const { data, error } = await supabase
      .from('users')
      .insert([{ email, name, phone, created_at: new Date() }])
      .select();
    
    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== API CONSULTATIONS =====
app.get('/api/consultations', async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ 
      error: 'Base de données non configurée',
      message: 'Supabase n\'est pas configuré sur ce serveur'
    });
  }
  
  try {
    const { data, error } = await supabase
      .from('consultations')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/consultations', async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ 
      error: 'Base de données non configurée',
      message: 'Supabase n\'est pas configuré sur ce serveur'
    });
  }
  
  try {
    const { user_id, date, time, type, notes } = req.body;
    
    const { data, error } = await supabase
      .from('consultations')
      .insert([{ 
        user_id, 
        date, 
        time, 
        type, 
        notes, 
        status: 'pending',
        created_at: new Date() 
      }])
      .select();
    
    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== API PAIEMENTS STRIPE =====
app.post('/api/payments/create-payment-intent', async (req, res) => {
  if (!stripe) {
    return res.status(503).json({ 
      error: 'Service de paiement non configuré',
      message: 'Stripe n\'est pas configuré sur ce serveur'
    });
  }
  
  try {
    const { amount, currency = 'eur', description } = req.body;
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100,
      currency,
      description,
      automatic_payment_methods: {
        enabled: true,
      },
    });
    
    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/payments/confirm', async (req, res) => {
  if (!stripe) {
    return res.status(503).json({ 
      error: 'Service de paiement non configuré',
      message: 'Stripe n\'est pas configuré sur ce serveur'
    });
  }
  
  try {
    const { paymentIntentId } = req.body;
    
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status === 'succeeded') {
      if (supabase) {
        const { data, error } = await supabase
          .from('payments')
          .insert([{
            stripe_payment_id: paymentIntentId,
            amount: paymentIntent.amount / 100,
            currency: paymentIntent.currency,
            status: 'completed',
            created_at: new Date()
          }])
          .select();
        
        if (error) throw error;
        
        res.json({ 
          success: true, 
          payment: data[0] 
        });
      } else {
        res.json({ 
          success: true, 
          message: 'Paiement confirmé (base de données non configurée)'
        });
      }
    } else {
      res.status(400).json({ 
        error: 'Paiement non confirmé' 
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Gestion des erreurs
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Erreur interne du serveur',
    message: err.message 
  });
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur Coquillage démarré sur le port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 API: http://localhost:${PORT}/api`);
  console.log(`🌐 Accueil: http://localhost:${PORT}/`);
});

module.exports = app;
