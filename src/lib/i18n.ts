'use client';

import { useCallback } from 'react';
import { useLang } from '@/contexts/LangContext';

export type Lang = 'en' | 'es';

const translations: Record<string, Record<Lang, string>> = {
  // Navigation
  'nav.find_food': { en: 'Find Food', es: 'Encontrar Comida' },
  'nav.request_help': { en: 'Request Help', es: 'Solicitar Ayuda' },
  'nav.home': { en: 'Home', es: 'Inicio' },

  // Hero
  'hero.title': { en: 'Find food near you in Kansas City', es: 'Encuentra comida cerca en Kansas City' },
  'hero.subtitle': {
    en: 'Free food resources, pantries, and community support across Kansas City',
    es: 'Recursos de alimentos gratuitos, despensas y apoyo comunitario en Kansas City',
  },
  'hero.cta_find': { en: 'Find a Pantry Near Me', es: 'Buscar una Despensa Cercana' },
  'hero.cta_help': { en: 'Request Help', es: 'Solicitar Ayuda' },

  // Feature cards
  'features.find_pantry.title': { en: 'Find a Pantry', es: 'Encontrar Despensa' },
  'features.find_pantry.desc': {
    en: 'Locate food pantries, distributions, and pop-up events near you',
    es: 'Ubica despensas, distribuciones y eventos emergentes cerca de ti',
  },
  'features.request_help.title': { en: 'Request Help', es: 'Solicitar Ayuda' },
  'features.request_help.desc': {
    en: 'Let us connect you with food resources that fit your situation',
    es: 'Permítenos conectarte con recursos de alimentos según tu situación',
  },
  'features.community.title': { en: 'Community Support', es: 'Apoyo Comunitario' },
  'features.community.desc': {
    en: 'Vote to bring food resources to neighborhoods that need them most',
    es: 'Vota para llevar recursos de alimentos a los vecindarios que más los necesitan',
  },

  // Stats
  'stats.sites': { en: 'Active Sites', es: 'Sitios Activos' },
  'stats.popups': { en: 'Active Popups', es: 'Eventos Activos' },
  'stats.households': { en: 'Households Served', es: 'Familias Atendidas' },

  // Map page
  'map.title': { en: 'Food Resources Map', es: 'Mapa de Recursos de Alimentos' },
  'map.search_zip': { en: 'Search by ZIP code', es: 'Buscar por código postal' },
  'map.filter_open': { en: 'Open Now', es: 'Abierto Ahora' },
  'map.filter_spanish': { en: 'Spanish Available', es: 'Español Disponible' },
  'map.filter_no_id': { en: 'No ID Required', es: 'Sin ID Requerida' },
  'map.filter_fresh': { en: 'Fresh Produce', es: 'Productos Frescos' },
  'map.filter_bus': { en: 'Bus Accessible', es: 'Accesible en Autobús' },
  'map.no_results': { en: 'No sites match your filters', es: 'No hay sitios que coincidan' },

  // Site card
  'site.open_now': { en: 'Open Now', es: 'Abierto Ahora' },
  'site.id_not_required': { en: 'No ID Required', es: 'Sin ID' },
  'site.cold_storage': { en: 'Fresh Produce', es: 'Productos Frescos' },
  'site.view_details': { en: 'View Details', es: 'Ver Detalles' },

  // Site detail
  'site.hours': { en: 'Hours', es: 'Horario' },
  'site.languages': { en: 'Languages Served', es: 'Idiomas Atendidos' },
  'site.id_req': { en: 'ID Required', es: 'Se Requiere ID' },
  'site.id_not_req': { en: 'No ID Required', es: 'Sin ID Requerida' },
  'site.need_score': { en: 'Community Need Score', es: 'Puntuación de Necesidad' },
  'site.request_help_cta': { en: 'Request Help Getting Here', es: 'Solicitar Ayuda Para Llegar' },
  'site.nearby_transit': { en: 'Nearby Bus Stops', es: 'Paradas de Autobús Cercanas' },
  'site.upcoming_events': { en: 'Upcoming Events', es: 'Próximos Eventos' },

  // Request help form
  'help.title': { en: 'Request Food Assistance', es: 'Solicitar Asistencia de Alimentos' },
  'help.subtitle': {
    en: 'We can help connect you with food resources in Kansas City',
    es: 'Podemos ayudarte a conectar con recursos de alimentos en Kansas City',
  },
  'help.zip': { en: 'Your ZIP Code', es: 'Tu Código Postal' },
  'help.barriers': { en: 'What barriers do you face?', es: '¿Qué barreras enfrentas?' },
  'help.barrier_no_car': { en: 'No car / transportation', es: 'Sin carro / transporte' },
  'help.barrier_language': { en: 'Language barrier', es: 'Barrera de idioma' },
  'help.barrier_disability': { en: 'Disability', es: 'Discapacidad' },
  'help.barrier_senior': { en: 'Senior citizen (65+)', es: 'Adulto mayor (65+)' },
  'help.barrier_infant': { en: 'Infant / young children', es: 'Bebé / niños pequeños' },
  'help.language': { en: 'Preferred Language', es: 'Idioma Preferido' },
  'help.contact': { en: 'Contact Info (optional)', es: 'Información de Contacto (opcional)' },
  'help.contact_hint': { en: 'Phone or email so we can follow up', es: 'Teléfono o correo para dar seguimiento' },
  'help.notes': { en: 'Additional Notes', es: 'Notas Adicionales' },
  'help.submit': { en: 'Submit Request', es: 'Enviar Solicitud' },
  'help.success_en': {
    en: 'Your request has been received. We will connect you with resources soon.',
    es: 'Tu solicitud ha sido recibida. Te conectaremos con recursos pronto.',
  },

  // Community page
  'community.vote_support': { en: 'I Support This', es: 'Apoyo Esto' },
  'community.votes_of': { en: 'of', es: 'de' },
  'community.votes_goal': { en: 'votes needed', es: 'votos necesarios' },
  'community.deadline': { en: 'Campaign ends', es: 'Campaña termina' },
  'community.poverty': { en: 'Poverty Rate', es: 'Tasa de Pobreza' },
  'community.no_car': { en: 'No Vehicle', es: 'Sin Vehículo' },
  'community.hispanic': { en: 'Hispanic/Latino', es: 'Hispano/Latino' },

  // Alerts
  'alert.urgent': { en: 'URGENT: Food Available', es: 'URGENTE: Alimentos Disponibles' },
  'alert.view_recs': { en: 'View Allocation Recommendations', es: 'Ver Recomendaciones' },
  'alert.spoilage': { en: 'Spoils in', es: 'Caduca en' },

  // General
  'general.loading': { en: 'Loading...', es: 'Cargando...' },
  'general.error': { en: 'Something went wrong', es: 'Algo salió mal' },
  'general.back': { en: 'Back', es: 'Regresar' },
  'general.learn_more': { en: 'Learn more', es: 'Más información' },
};

export function t(key: string, lang: Lang): string {
  return translations[key]?.[lang] ?? translations[key]?.en ?? key;
}

export function useLanguage(): { lang: Lang; setLang: (l: Lang) => void; t: (key: string) => string } {
  const { lang, setLang } = useLang();
  const translate = useCallback((key: string) => t(key, lang), [lang]);
  return { lang, setLang, t: translate };
}

export function getLangFromCookie(cookieHeader: string | null): Lang {
  if (!cookieHeader) return 'en';
  const match = cookieHeader.match(/lang=(en|es)/);
  return (match?.[1] as Lang) ?? 'en';
}
