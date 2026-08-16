/**
 * Validadores e Sanitizadores do PALCO
 * 
 * Toda entrada do usuário passa por aqui antes de ir para o Supabase.
 * Isso é uma camada ADICIONAL de proteção — o banco tem suas próprias
 * constraints (CHECK, VARCHAR limits, etc.), mas validar no client
 * melhora a UX e reduz chamadas desnecessárias ao servidor.
 */

import { BUSINESS_RULES } from './constants';

// ============================
// Sanitização
// ============================

/**
 * Remove tags HTML e trim whitespace.
 * Previne XSS em inputs de texto que serão renderizados.
 */
export function sanitizeText(input) {
  if (typeof input !== 'string') return '';
  return input
    .replace(/&lt;/g, '<')   // Decode entities comuns PRIMEIRO
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/<[^>]*>/g, '') // DEPOIS remove todas as tags HTML (incluindo as decodificadas)
    .trim();
}

// ============================
// Validação de Email
// ============================

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/**
 * Valida formato de email.
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateEmail(email) {
  const sanitized = sanitizeText(email);

  if (!sanitized) {
    return { valid: false, error: 'Email é obrigatório.' };
  }

  if (sanitized.length > 320) {
    return { valid: false, error: 'Email muito longo.' };
  }

  if (!EMAIL_REGEX.test(sanitized)) {
    return { valid: false, error: 'Formato de email inválido.' };
  }

  return { valid: true };
}

// ============================
// Validação de Senha
// ============================

/**
 * Valida força da senha.
 * Requisitos: mínimo 8 caracteres, 1 letra maiúscula, 1 número.
 * @returns {{ valid: boolean, error?: string }}
 */
export function validatePassword(password) {
  if (typeof password !== 'string') {
    return { valid: false, error: 'Senha é obrigatória.' };
  }

  if (password.length < BUSINESS_RULES.MIN_PASSWORD_LENGTH) {
    return { valid: false, error: `Senha deve ter no mínimo ${BUSINESS_RULES.MIN_PASSWORD_LENGTH} caracteres.` };
  }

  if (password.length > 128) {
    return { valid: false, error: 'Senha muito longa (máximo 128 caracteres).' };
  }

  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Senha deve conter pelo menos 1 letra maiúscula.' };
  }

  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'Senha deve conter pelo menos 1 número.' };
  }

  return { valid: true };
}

// ============================
// Validação de Nome
// ============================

/**
 * Valida nome do usuário / nome artístico / nome do bar.
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateName(name) {
  const sanitized = sanitizeText(name);

  if (!sanitized) {
    return { valid: false, error: 'Nome é obrigatório.' };
  }

  if (sanitized.length < 2) {
    return { valid: false, error: 'Nome deve ter no mínimo 2 caracteres.' };
  }

  if (sanitized.length > BUSINESS_RULES.MAX_NAME_LENGTH) {
    return { valid: false, error: `Nome deve ter no máximo ${BUSINESS_RULES.MAX_NAME_LENGTH} caracteres.` };
  }

  return { valid: true, sanitized };
}

export function validateProfessionalUrl(url) {
  const sanitized = sanitizeText(url);
  if (!sanitized) return { valid: true, sanitized: null };
  if (sanitized.length > 220) {
    return { valid: false, error: 'Link profissional muito longo.' };
  }

  try {
    const parsed = new URL(sanitized);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('invalid protocol');
  } catch {
    return { valid: false, error: 'Use um link iniciado por http:// ou https://.' };
  }

  return { valid: true, sanitized };
}

export function validateBrazilState(state) {
  const sanitized = sanitizeText(state).toUpperCase();
  if (!sanitized) return { valid: true, sanitized: null };
  if (!/^[A-Z]{2}$/.test(sanitized)) {
    return { valid: false, error: 'Informe o estado com duas letras, como PR.' };
  }
  return { valid: true, sanitized };
}

// ============================
// Validação de Valor de Pedido
// ============================

/**
 * Valida valor do bounty (pedido musical ou gorjeta).
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateBountyValue(value) {
  const numValue = Number(value);

  if (isNaN(numValue)) {
    return { valid: false, error: 'Valor inválido.' };
  }

  if (numValue < BUSINESS_RULES.MIN_BOUNTY_VALUE) {
    return { valid: false, error: `Valor mínimo é R$ ${BUSINESS_RULES.MIN_BOUNTY_VALUE.toFixed(2)}.` };
  }

  if (numValue > BUSINESS_RULES.MAX_BOUNTY_VALUE) {
    return { valid: false, error: `Valor máximo é R$ ${BUSINESS_RULES.MAX_BOUNTY_VALUE.toFixed(2)}.` };
  }

  return { valid: true };
}

// ============================
// Validação de Mensagem do Chat
// ============================

/**
 * Valida e sanitiza mensagem de chat.
 * @returns {{ valid: boolean, error?: string, sanitized?: string }}
 */
export function validateChatMessage(message) {
  const sanitized = sanitizeText(message);

  if (!sanitized) {
    return { valid: false, error: 'Mensagem não pode estar vazia.' };
  }

  if (sanitized.length > BUSINESS_RULES.MAX_CHAT_MESSAGE_LENGTH) {
    return { valid: false, error: `Mensagem deve ter no máximo ${BUSINESS_RULES.MAX_CHAT_MESSAGE_LENGTH} caracteres.` };
  }

  return { valid: true, sanitized };
}

// ============================
// Validação de Título da Música
// ============================

/**
 * Valida título de música para pedido.
 * @returns {{ valid: boolean, error?: string, sanitized?: string }}
 */
export function validateSongTitle(title) {
  const sanitized = sanitizeText(title);

  if (!sanitized) {
    return { valid: false, error: 'Nome da música é obrigatório.' };
  }

  if (sanitized.length > BUSINESS_RULES.MAX_SONG_TITLE_LENGTH) {
    return { valid: false, error: `Nome da música deve ter no máximo ${BUSINESS_RULES.MAX_SONG_TITLE_LENGTH} caracteres.` };
  }

  return { valid: true, sanitized };
}

// ============================
// Validação de Dedicatória
// ============================

/**
 * Valida texto de dedicatória (opcional).
 * @returns {{ valid: boolean, error?: string, sanitized?: string }}
 */
export function validateDedication(text) {
  if (!text || text.trim() === '') {
    return { valid: true, sanitized: null }; // Dedicatória é opcional
  }

  const sanitized = sanitizeText(text);

  if (sanitized.length > BUSINESS_RULES.MAX_DEDICATION_LENGTH) {
    return { valid: false, error: `Dedicatória deve ter no máximo ${BUSINESS_RULES.MAX_DEDICATION_LENGTH} caracteres.` };
  }

  return { valid: true, sanitized };
}
