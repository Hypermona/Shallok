import { ITranslationProvider, TranslationOptions, TranslationRequestItem, TranslationResponseItem } from '../types.js';

const MOCK_DICTIONARY: Record<string, Record<string, string>> = {
  fr: {
    'Pay now': 'Payer maintenant',
    'Sign in': 'Se connecter',
    'Sign In': 'Se connecter',
    'Sign out': 'Se déconnecter',
    'Sign Out': 'Se déconnecter',
    'Sign in to your account': 'Connectez-vous à votre compte',
    'Enter your email': 'Entrez votre e-mail',
    'Submit login form': 'Soumettre le formulaire de connexion',
    'Welcome': 'Bienvenue',
    'Settings': 'Paramètres',
    'Language': 'Langue',
    'Home': 'Accueil',
    'Order placed successfully': 'Commande passée avec succès',
  },
  hi: {
    'Pay now': 'अभी भुगतान करें',
    'Sign in': 'साइन इन करें',
    'Sign In': 'साइन इन करें',
    'Sign out': 'साइन आउट करें',
    'Sign Out': 'साइन आउट करें',
    'Sign in to your account': 'अपने खाते में साइन इन करें',
    'Enter your email': 'अपना ईमेल दर्ज करें',
    'Email address': 'ईमेल पता',
    'Submit login form': 'लॉगिन फॉर्म सबमिट करें',
    'Checkout summary': 'चेकआउट सारांश',
    'Status:': 'स्थिति:',
    'Guest User': 'अतिथि उपयोगकर्ता',
    'VIP Member': 'वीआईपी सदस्य',
    'Welcome': 'स्वागत है',
    'Welcome to Shallok Store': 'शालोक स्टोर में आपका स्वागत है',
    'Your one-stop destination for global shopping.': 'वैश्विक खरीदारी के लिए आपका वन-स्टॉप गंतव्य।',
    'Settings': 'सेटिंग्स',
    'Language': 'भाषा',
    'Home': 'होम',
    'Order placed successfully': 'ऑर्डर सफलतापूर्वक दिया गया',
  },
  kn: {
    'Pay now': 'ಈಗ ಪಾವತಿಸಿ',
    'Sign in': 'ಸೈನ್ ಇನ್ ಮಾಡಿ',
    'Sign In': 'ಸೈನ್ ಇನ್ ಮಾಡಿ',
    'Sign out': 'ಸೈನ್ ಔಟ್ ಮಾಡಿ',
    'Sign Out': 'ಸೈನ್ ಔಟ್ ಮಾಡಿ',
    'Sign in to your account': 'ನಿಮ್ಮ ಖಾತೆಗೆ ಸೈನ್ ಇನ್ ಮಾಡಿ',
    'Enter your email': 'ನಿಮ್ಮ ಇಮೇಲ್ ನಮೂದಿಸಿ',
    'Email address': 'ಇಮೇಲ್ ವಿಳಾಸ',
    'Submit login form': 'ಲಾಗಿನ್ ಫಾರ್ಮ್ ಸಲ್ಲಿಸಿ',
    'Checkout summary': 'ಚೆಕ್ಔಟ್ ಸಾರಾಂಶ',
    'Status:': 'ಸ್ಥಿತಿ:',
    'Guest User': 'ಅತಿಥಿ ಬಳಕೆದಾರ',
    'VIP Member': 'ವಿಐಪಿ ಸದಸ್ಯ',
    'Welcome': 'ಸ್ವಾಗತ',
    'Welcome to Shallok Store': 'ಶಲ್ಲೋಕ್ ಅಂಗಡಿಗೆ ಸುಸ್ವಾಗತ',
    'Your one-stop destination for global shopping.': 'ಜಾಗತಿಕ ಶಾಪಿಂಗ್‌ಗಾಗಿ ನಿಮ್ಮ ಏಕೈಕ ತಾಣ.',
    'Settings': 'ಸೆಟ್ಟಿಂಗ್‌ಗಳು',
    'Language': 'ಭಾಷೆ',
    'Home': 'ಮುಖಪುಟ',
    'Order placed successfully': 'ಆರ್ಡರ್ ಯಶಸ್ವಿಯಾಗಿ ಇರಿಸಲಾಗಿದೆ',
  },
  de: {
    'Pay now': 'Jetzt bezahlen',
    'Sign in': 'Anmelden',
    'Sign In': 'Anmelden',
    'Sign out': 'Abmelden',
    'Sign Out': 'Abmelden',
    'Sign in to your account': 'Melden Sie sich bei Ihrem Konto an',
    'Enter your email': 'Geben Sie Ihre E-Mail ein',
    'Submit login form': 'Anmeldeformular absenden',
    'Welcome': 'Willkommen',
    'Settings': 'Einstellungen',
    'Language': 'Sprache',
    'Home': 'Startseite',
    'Order placed successfully': 'Bestellung erfolgreich aufgegeben',
  },
};

export class MockTranslationProvider implements ITranslationProvider {
  name = 'mock';

  constructor(private shouldFail = false) {}

  async translateBatch(
    items: TranslationRequestItem[],
    options: TranslationOptions
  ): Promise<TranslationResponseItem[]> {
    if (this.shouldFail) {
      throw new Error('Mock translation provider simulated failure.');
    }

    const targetDict = MOCK_DICTIONARY[options.targetLocale] || {};

    return items.map((item) => {
      // Check glossary first
      if (options.glossary && options.glossary[item.content]) {
        return {
          key: item.key,
          translatedValue: options.glossary[item.content],
        };
      }

      // Check dictionary
      const directMatch = targetDict[item.content];
      if (directMatch) {
        return {
          key: item.key,
          translatedValue: directMatch,
        };
      }

      // If text contains placeholders like "Hello, {name}!"
      // Preserve placeholders exactly!
      let translated = item.content;
      for (const [en, localized] of Object.entries(targetDict)) {
        if (translated.includes(en)) {
          translated = translated.replace(en, localized);
        }
      }

      if (translated === item.content) {
        // Fallback: prefix with locale while preserving placeholders
        translated = `[${options.targetLocale.toUpperCase()}] ${item.content}`;
      }

      return {
        key: item.key,
        translatedValue: translated,
      };
    });
  }
}
