import React, { useState, useEffect } from 'react';
import { BioLinkConfig, BioLinkBlock, BioLinkOrder } from '../types';
import { submitBioLinkOrder, getBioLinkConfig } from '../services/storageService';
import { 
  MapPin, Phone, Mail, Instagram, Send, Globe, FileText, ShoppingBag, 
  Share2, UserPlus, Check, X, Loader2, Sparkles, Navigation, ChevronLeft,
  MessageCircle, ExternalLink, ArrowRight, Building2, PhoneCall, Bot
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

export const processBioImageUrl = (rawUrl?: string, defaultFallback: string = ''): string => {
  if (!rawUrl || typeof rawUrl !== 'string') return defaultFallback;
  let url = rawUrl.trim();
  if (!url) return defaultFallback;

  // Transform Google Drive links to direct view URLs
  if (url.includes('drive.google.com')) {
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return `https://lh3.googleusercontent.com/d/${match[1]}`;
    }
  }

  // Transform Dropbox links
  if (url.includes('dropbox.com')) {
    url = url.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('?dl=0', '');
  }

  // Normalize protocol
  if (url.startsWith('//')) {
    url = `https:${url}`;
  } else if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('data:') && !url.startsWith('blob:') && !url.startsWith('/')) {
    url = `https://${url}`;
  }

  return url;
};

interface PublicBioPageProps {
  config: BioLinkConfig;
  onBackToApp?: () => void;
  isEmbeddedPreview?: boolean;
}

export const PublicBioPage: React.FC<PublicBioPageProps> = ({ config: initialConfig, onBackToApp, isEmbeddedPreview = false }) => {
  const [config, setConfig] = useState<BioLinkConfig>(initialConfig);
  const [activeOrderModal, setActiveOrderModal] = useState(false);
  const [orderForm, setOrderForm] = useState({
    customerName: '',
    customerPhone: '',
    productTitle: 'نخ پلی استر / اسپندکس',
    quantity: '۱ کارتن',
    notes: ''
  });
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);

  useEffect(() => {
    setConfig(initialConfig);
  }, [initialConfig]);

  useEffect(() => {
    // If provided config has no blocks, fetch live config from server
    if (!initialConfig || !initialConfig.blocks || initialConfig.blocks.length === 0) {
      getBioLinkConfig().then(liveData => {
        if (liveData) {
          setConfig(liveData);
        }
      }).catch(console.error);
    }
  }, []);

  // Group active blocks by category
  const activeBlocks = (config.blocks || [])
    .filter(b => b.isActive)
    .sort((a, b) => a.order - b.order);

  const botBlocks = activeBlocks.filter(b => 
    b.category === 'bots' || 
    b.iconName === 'telegram_bot' || 
    b.iconName === 'bale_bot' || 
    b.iconName === 'telegram' || 
    b.iconName === 'bale' ||
    b.title.includes('تلگرام') ||
    b.title.includes('بله')
  );
  const mapBlocks = activeBlocks.filter(b => b.category === 'maps');
  const phoneBlocks = activeBlocks.filter(b => b.category === 'phones');
  const emailBlocks = activeBlocks.filter(b => b.category === 'emails');
  const socialBlocks = activeBlocks.filter(b => 
    b.category === 'socials' && 
    !botBlocks.some(bot => bot.id === b.id)
  );
  const catalogBlocks = activeBlocks.filter(b => b.category === 'catalog');
  const orderBlocks = activeBlocks.filter(b => b.category === 'order_form');
  const otherBlocks = activeBlocks.filter(b => 
    !['maps', 'phones', 'emails', 'socials', 'catalog', 'order_form', 'bots'].includes(b.category) &&
    !botBlocks.some(bot => bot.id === b.id)
  );

  // Generate vCard string for 1-click contact saving
  const handleDownloadVCard = () => {
    const mainPhone = phoneBlocks[0]?.value || '09125088474';
    const mainEmail = emailBlocks[0]?.value || 'lepanbaft55@gmail.com';
    const title = config.companyTitle || 'شرکت تولیدی لپان بافت';
    
    const vcard = `BEGIN:VCARD
VERSION:3.0
FN:${title}
ORG:${title}
TITLE:${config.companySubtitle || ''}
TEL;TYPE=CELL,VOICE:${mainPhone}
${phoneBlocks[1] ? `TEL;TYPE=WORK,VOICE:${phoneBlocks[1].value}\n` : ''}
EMAIL;TYPE=PREF,INTERNET:${mainEmail}
NOTE:${config.addressText || ''}
URL:${window.location.href}
END:VCARD`;

    const blob = new Blob([vcard], { type: 'text/vcard;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${config.slug || 'company'}_contact.vcf`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('کارت مخاطب آماده ذخیره‌سازی در گوشی شد.');
  };

  const handleShare = async () => {
    const shareUrl = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: config.companyTitle,
          text: config.companySubtitle,
          url: shareUrl,
        });
      } catch (e) {
        // Fallback to copy
      }
    } else {
      navigator.clipboard.writeText(shareUrl);
      toast.success('لینک صفحه عمومی کپی شد.');
    }
  };

  const handleBlockClick = (block: BioLinkBlock) => {
    if (block.category === 'order_form') {
      setActiveOrderModal(true);
      return;
    }

    if (block.category === 'phones') {
      const cleanPhone = block.value.replace(/[^0-9+]/g, '');
      window.location.href = `tel:${cleanPhone}`;
      return;
    }

    if (block.category === 'emails') {
      window.location.href = `mailto:${block.value}`;
      return;
    }

    // Bots handling (Telegram and Bale)
    if (block.category === 'bots' || block.iconName === 'telegram_bot' || block.iconName === 'bale_bot' || block.title.includes('تلگرام') || block.title.includes('بله')) {
      let val = (block.value || '').trim();
      const isTelegram = block.iconName === 'telegram_bot' || block.iconName === 'telegram' || block.title.includes('تلگرام') || val.includes('t.me');
      const isBale = block.iconName === 'bale_bot' || block.iconName === 'bale' || block.title.includes('بله') || val.includes('ble.ir');

      if (isTelegram) {
        const clean = val.replace(/^@/, '').replace(/^https?:\/\/t\.me\//, '');
        val = `https://t.me/${clean}`;
      } else if (isBale) {
        const clean = val.replace(/^@/, '').replace(/^https?:\/\/ble\.ir\//, '');
        val = `https://ble.ir/${clean}`;
      } else if (!val.startsWith('http://') && !val.startsWith('https://')) {
        val = `https://${val}`;
      }
      window.open(val, '_blank', 'noopener,noreferrer');
      return;
    }

    if (block.value && block.value !== 'order_form') {
      let url = block.value;
      if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('mailto:') && !url.startsWith('tel:')) {
        url = `https://${url}`;
      }
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderForm.customerName || !orderForm.customerPhone) {
      toast.error('لطفاً نام و شماره تماس را وارد کنید.');
      return;
    }
    setSubmittingOrder(true);
    try {
      const res = await submitBioLinkOrder(orderForm);
      if (res && res.success) {
        setOrderSuccess(true);
        toast.success(res.message || 'سفارش شما با موفقیت ثبت شد.');
      } else {
        toast.error(res?.error || 'خطا در ثبت سفارش');
      }
    } catch (e: any) {
      toast.error('خطا در ارتباط با سرور: ' + (e.message || ''));
    } finally {
      setSubmittingOrder(false);
    }
  };

  // Icon Helper Function
  const renderBlockIcon = (block: BioLinkBlock) => {
    const iconName = block.iconName || '';
    if (iconName === 'telegram_bot' || iconName === 'telegram' || block.title.includes('تلگرام')) {
      return (
        <div className="w-10 h-10 rounded-2xl bg-sky-500/10 text-sky-500 dark:text-sky-400 flex items-center justify-center shrink-0 shadow-sm border border-sky-500/20">
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.37.74-.56 2.92-1.27 4.86-2.11 5.83-2.52 2.77-1.15 3.35-1.35 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06-.01.19-.03.32z"/>
          </svg>
        </div>
      );
    }
    if (iconName === 'bale_bot' || iconName === 'bale' || block.title.includes('بله')) {
      return (
        <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 font-black text-xs shadow-sm border border-emerald-500/20">
          <span className="px-1.5 py-0.5 rounded-lg bg-emerald-600 text-white text-[11px] font-black tracking-wider shadow-sm">بله</span>
        </div>
      );
    }
    if (iconName === 'neshan') {
      return (
        <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 font-black text-xs">
          نشان
        </div>
      );
    }
    if (iconName === 'balad') {
      return (
        <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 font-black text-xs">
          بلد
        </div>
      );
    }
    if (iconName === 'google_maps') {
      return (
        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
          <MapPin className="w-5 h-5" />
        </div>
      );
    }
    if (block.category === 'phones' || iconName === 'mobile' || iconName === 'phone') {
      return (
        <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
          <PhoneCall className="w-5 h-5" />
        </div>
      );
    }
    if (block.category === 'emails' || iconName === 'email') {
      return (
        <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
          <Mail className="w-5 h-5" />
        </div>
      );
    }
    if (block.category === 'socials' || iconName === 'instagram') {
      return (
        <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
          <Instagram className="w-5 h-5" />
        </div>
      );
    }
    if (block.category === 'catalog' || iconName === 'file') {
      return (
        <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
          <FileText className="w-5 h-5" />
        </div>
      );
    }
    if (block.category === 'order_form' || iconName === 'order') {
      return (
        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
          <ShoppingBag className="w-5 h-5" />
        </div>
      );
    }
    return (
      <div className="w-9 h-9 rounded-xl bg-slate-500/10 text-slate-600 dark:text-slate-400 flex items-center justify-center shrink-0">
        <Globe className="w-5 h-5" />
      </div>
    );
  };

  // Color theme helper for block cards
  const getBlockCardStyle = (block: BioLinkBlock) => {
    switch (block.colorTheme) {
      case 'rose':
        return 'bg-rose-50/80 hover:bg-rose-100/80 border-rose-200/80 text-rose-950 dark:bg-rose-950/30 dark:hover:bg-rose-900/40 dark:border-rose-900/50 dark:text-rose-100';
      case 'indigo':
        return 'bg-indigo-50/80 hover:bg-indigo-100/80 border-indigo-200/80 text-indigo-950 dark:bg-indigo-950/30 dark:hover:bg-indigo-900/40 dark:border-indigo-900/50 dark:text-indigo-100';
      case 'emerald':
        return 'bg-emerald-50/80 hover:bg-emerald-100/80 border-emerald-200/80 text-emerald-950 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/40 dark:border-emerald-900/50 dark:text-emerald-100';
      case 'amber':
        return 'bg-amber-50/80 hover:bg-amber-100/80 border-amber-200/80 text-amber-950 dark:bg-amber-950/30 dark:hover:bg-amber-900/40 dark:border-amber-900/50 dark:text-amber-100';
      case 'purple':
        return 'bg-purple-50/80 hover:bg-purple-100/80 border-purple-200/80 text-purple-950 dark:bg-purple-950/30 dark:hover:bg-purple-900/40 dark:border-purple-900/50 dark:text-purple-100';
      case 'blue':
        return 'bg-blue-50/80 hover:bg-blue-100/80 border-blue-200/80 text-blue-950 dark:bg-blue-950/30 dark:hover:bg-blue-900/40 dark:border-blue-900/50 dark:text-blue-100';
      case 'slate':
      default:
        return 'bg-white hover:bg-slate-50 border-slate-200/90 text-slate-900 dark:bg-slate-900 dark:hover:bg-slate-800/80 dark:border-slate-800 dark:text-slate-100 shadow-sm';
    }
  };

  const DEFAULT_COVER = 'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?q=80&w=1000';
  const DEFAULT_AVATAR = '/lepan-logo.png';

  const processedCover = processBioImageUrl(config.coverUrl, DEFAULT_COVER);
  const processedAvatar = processBioImageUrl(config.avatarUrl, DEFAULT_AVATAR);

  return (
    <div className={`w-full dir-rtl font-sans bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-200 flex flex-col items-center justify-start public-bio-scroll-view ${
      isEmbeddedPreview ? 'p-0 h-full max-h-full overflow-y-auto' : 'h-screen h-dvh max-h-screen max-h-dvh overflow-y-auto overflow-x-hidden py-6 px-3'
    }`}>
      <Toaster position="top-center" />
      
      {/* Top Action Bar if in full screen */}
      {!isEmbeddedPreview && (
        <div className="w-full max-w-md mb-4 flex items-center justify-between px-2 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-black text-slate-800 dark:text-slate-200">کارت ویزیت دیجیتال لپان لینک</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="p-2 rounded-xl bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 text-xs font-bold flex items-center justify-center shadow-sm hover:bg-slate-50 transition-colors"
              title="اشتراک‌گذاری"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleDownloadVCard}
              className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>ذخیره مخاطب</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Lepan Link Card Wrapper */}
      <div className={`w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl overflow-hidden shadow-2xl transition-all duration-300 ${
        isEmbeddedPreview ? 'shadow-none rounded-2xl border-0' : 'mb-12'
      }`}>
        
        {/* Cover Photo Header */}
        <div className="relative w-full h-44 bg-slate-800 overflow-hidden">
          <img
            src={processedCover}
            alt="Cover"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover opacity-90 scale-105 transform hover:scale-100 transition-transform duration-700"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              if (target.src !== DEFAULT_COVER) {
                target.src = DEFAULT_COVER;
              }
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-black/20" />
          
          {/* Lepan Link Badge */}
          <div className="absolute top-3 left-3 bg-white/20 backdrop-blur-md border border-white/30 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
            <Sparkles className="w-3 h-3 text-amber-300" />
            <span>لپان لینک اختصاصی</span>
          </div>
        </div>

        {/* Profile Info Block */}
        <div className="relative px-5 pt-0 pb-6 text-center border-b border-slate-100 dark:border-slate-800/80">
          {/* Avatar Logo */}
          <div className="relative -mt-16 mb-3 inline-block">
            <div className="w-28 h-28 rounded-full bg-white dark:bg-slate-900 p-1.5 shadow-xl border-2 border-white dark:border-slate-800 mx-auto">
              <img
                src={processedAvatar}
                alt="Logo"
                referrerPolicy="no-referrer"
                className="w-full h-full rounded-full object-cover bg-slate-50 dark:bg-slate-800"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  if (target.src !== DEFAULT_AVATAR) {
                    target.src = DEFAULT_AVATAR;
                  }
                }}
              />
            </div>
          </div>

          {/* Title & Description */}
          <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
            {config.companyTitle || 'شرکت تولیدی لپان بافت'}
          </h1>
          <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 font-medium leading-relaxed max-w-xs mx-auto">
            {config.companySubtitle || 'تولید انواع نخ پلی استر ، کش ، اسپندکس ، POY و ساپورت'}
          </p>

          {/* Quick Contact & Save vCard Buttons inside Hero */}
          <div className="mt-4 flex items-center justify-center gap-2">
            <button
              onClick={handleDownloadVCard}
              className="px-4 py-2 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 text-xs font-extrabold flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
            >
              <UserPlus className="w-4 h-4" />
              <span>ذخیره در مخاطبین</span>
            </button>
            <button
              onClick={() => setActiveOrderModal(true)}
              className="px-4 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-md shadow-emerald-500/20 active:scale-95 transition-all"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>ثبت سفارش آنلاین</span>
            </button>
          </div>
        </div>

        {/* Dynamic Blocks Container */}
        <div className="p-4 space-y-5 bg-slate-50/50 dark:bg-slate-950/40 min-h-[350px]">
          
          {/* 1. Telegram & Bale Bots Section */}
          {botBlocks.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 px-1">
                <Bot className="w-3.5 h-3.5 text-sky-500" />
                <span>بات‌ها و پیام‌رسان‌ها (تلگرام و بله)</span>
              </div>
              <div className="space-y-2">
                {botBlocks.map(block => (
                  <button
                    key={block.id}
                    onClick={() => handleBlockClick(block)}
                    className={`w-full p-3.5 rounded-2xl border flex items-center justify-between transition-all duration-200 text-right active:scale-[0.98] ${getBlockCardStyle(block)}`}
                  >
                    <div className="flex items-center gap-3">
                      {renderBlockIcon(block)}
                      <div>
                        <div className="font-bold text-xs">{block.title}</div>
                        {block.subtitle && (
                          <div className="text-[10px] opacity-75 font-medium mt-0.5 line-clamp-1">{block.subtitle}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {block.badge && (
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-lg bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                          {block.badge}
                        </span>
                      )}
                      <ExternalLink className="w-4 h-4 opacity-50 shrink-0" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 2. Maps & Navigation Section */}
          {mapBlocks.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 px-1">
                <Navigation className="w-3.5 h-3.5 text-rose-500" />
                <span>آدرس و مسیریابی</span>
              </div>
              <div className="space-y-2">
                {mapBlocks.map(block => (
                  <button
                    key={block.id}
                    onClick={() => handleBlockClick(block)}
                    className={`w-full p-3 rounded-2xl border flex items-center justify-between transition-all duration-200 text-right active:scale-[0.98] ${getBlockCardStyle(block)}`}
                  >
                    <div className="flex items-center gap-3">
                      {renderBlockIcon(block)}
                      <div>
                        <div className="font-bold text-xs">{block.title}</div>
                        {block.subtitle && (
                          <div className="text-[10px] opacity-75 font-medium mt-0.5 line-clamp-1">{block.subtitle}</div>
                        )}
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 opacity-50 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 2. Phone Contact Section */}
          {phoneBlocks.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 px-1">
                <Phone className="w-3.5 h-3.5 text-blue-500" />
                <span>راه‌های ارتباطی</span>
              </div>
              <div className="space-y-2">
                {phoneBlocks.map(block => (
                  <button
                    key={block.id}
                    onClick={() => handleBlockClick(block)}
                    className={`w-full p-3.5 rounded-2xl border flex items-center justify-between transition-all duration-200 text-right active:scale-[0.98] ${getBlockCardStyle(block)}`}
                  >
                    <div className="flex items-center gap-3">
                      {renderBlockIcon(block)}
                      <div>
                        <div className="font-bold text-xs">{block.title}</div>
                        {block.subtitle && (
                          <div className="text-[10px] opacity-75 font-mono dir-ltr text-right mt-0.5">{block.subtitle}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold dir-ltr opacity-90">{block.value}</span>
                      <PhoneCall className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 3. Email & Messaging Section */}
          {emailBlocks.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 px-1">
                <Mail className="w-3.5 h-3.5 text-indigo-500" />
                <span>ایمیل و پیام‌رسان‌ها</span>
              </div>
              <div className="space-y-2">
                {emailBlocks.map(block => (
                  <button
                    key={block.id}
                    onClick={() => handleBlockClick(block)}
                    className={`w-full p-3.5 rounded-2xl border flex items-center justify-between transition-all duration-200 text-right active:scale-[0.98] ${getBlockCardStyle(block)}`}
                  >
                    <div className="flex items-center gap-3">
                      {renderBlockIcon(block)}
                      <div>
                        <div className="font-bold text-xs">{block.title}</div>
                        <div className="text-[11px] font-mono opacity-80 mt-0.5 dir-ltr text-right">{block.value}</div>
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 opacity-50 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 4. Social Media Section */}
          {socialBlocks.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 px-1">
                <Instagram className="w-3.5 h-3.5 text-purple-500" />
                <span>شبکه‌های اجتماعی</span>
              </div>
              <div className="space-y-2">
                {socialBlocks.map(block => (
                  <button
                    key={block.id}
                    onClick={() => handleBlockClick(block)}
                    className={`w-full p-3.5 rounded-2xl border flex items-center justify-between transition-all duration-200 text-right active:scale-[0.98] ${getBlockCardStyle(block)}`}
                  >
                    <div className="flex items-center gap-3">
                      {renderBlockIcon(block)}
                      <div>
                        <div className="font-bold text-xs">{block.title}</div>
                        {block.subtitle && (
                          <div className="text-[10px] opacity-75 mt-0.5">{block.subtitle}</div>
                        )}
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 opacity-50 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 5. Catalog & Files Section */}
          {catalogBlocks.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 px-1">
                <FileText className="w-3.5 h-3.5 text-amber-500" />
                <span>کاتالوگ و مشخصات کالاها</span>
              </div>
              <div className="space-y-2">
                {catalogBlocks.map(block => (
                  <button
                    key={block.id}
                    onClick={() => handleBlockClick(block)}
                    className={`w-full p-3.5 rounded-2xl border flex items-center justify-between transition-all duration-200 text-right active:scale-[0.98] ${getBlockCardStyle(block)}`}
                  >
                    <div className="flex items-center gap-3">
                      {renderBlockIcon(block)}
                      <div>
                        <div className="font-bold text-xs">{block.title}</div>
                        {block.subtitle && (
                          <div className="text-[10px] opacity-75 mt-0.5">{block.subtitle}</div>
                        )}
                      </div>
                    </div>
                    <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 6. Order Form & Custom Blocks */}
          {(orderBlocks.length > 0 || otherBlocks.length > 0) && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 px-1">
                <ShoppingBag className="w-3.5 h-3.5 text-emerald-500" />
                <span>خدمات و درخواست‌ها</span>
              </div>
              <div className="space-y-2">
                {[...orderBlocks, ...otherBlocks].map(block => (
                  <button
                    key={block.id}
                    onClick={() => handleBlockClick(block)}
                    className={`w-full p-3.5 rounded-2xl border flex items-center justify-between transition-all duration-200 text-right active:scale-[0.98] ${getBlockCardStyle(block)}`}
                  >
                    <div className="flex items-center gap-3">
                      {renderBlockIcon(block)}
                      <div>
                        <div className="font-bold text-xs">{block.title}</div>
                        {block.subtitle && (
                          <div className="text-[10px] opacity-75 mt-0.5">{block.subtitle}</div>
                        )}
                      </div>
                    </div>
                    <ChevronLeft className="w-4 h-4 opacity-50 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer info */}
        <div className="p-4 text-center bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
          <div className="font-bold text-slate-700 dark:text-slate-300">
            {config.companyTitle || 'شرکت تولیدی لپان بافت'}
          </div>
          <div className="text-[10px] mt-1 text-slate-400">
            طراحی شده اختصاصی - لپان لینک هوشمند ارائه‌دهنده کارت ویزیت و QR کد
          </div>
        </div>

      </div>

      {/* Order Modal Form */}
      {activeOrderModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in dir-rtl">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl relative overflow-hidden">
            <button
              onClick={() => {
                setActiveOrderModal(false);
                setOrderSuccess(false);
              }}
              className="absolute top-4 left-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {orderSuccess ? (
              <div className="py-8 text-center space-y-3">
                <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto border border-emerald-200 dark:border-emerald-800">
                  <Check className="w-8 h-8" />
                </div>
                <h3 className="font-black text-lg text-slate-900 dark:text-white">
                  درخواست شما با موفقیت ثبت شد
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs mx-auto">
                  از تماس شما متشکریم. کارشناسان واحد فروش شرکت تولیدی لپان بافت در اسرع وقت با شما تماس خواهند گرفت.
                </p>
                <button
                  onClick={() => {
                    setActiveOrderModal(false);
                    setOrderSuccess(false);
                  }}
                  className="mt-4 px-6 py-2.5 rounded-2xl bg-emerald-600 text-white font-extrabold text-xs shadow-md"
                >
                  تایید و بستن
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitOrder} className="space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-base text-slate-900 dark:text-white">
                      ثبت سفارش و استعلام قیمت
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      اطلاعات خود را وارد کنید تا کارشناسان فروش با شما تماس بگیرند
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      نام و نام خانوادگی / نام خریدار *
                    </label>
                    <input
                      type="text"
                      required
                      value={orderForm.customerName}
                      onChange={(e) => setOrderForm({ ...orderForm, customerName: e.target.value })}
                      placeholder="مثال: علی محمدی (تولیدی بافت)"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      شماره همراه جهت تماس *
                    </label>
                    <input
                      type="tel"
                      required
                      value={orderForm.customerPhone}
                      onChange={(e) => setOrderForm({ ...orderForm, customerPhone: e.target.value })}
                      placeholder="09123456789"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-xs font-mono font-medium dir-ltr text-right focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      نوع کالا یا نخ درخواستی
                    </label>
                    <select
                      value={orderForm.productTitle}
                      onChange={(e) => setOrderForm({ ...orderForm, productTitle: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="نخ پلی استر">نخ پلی استر</option>
                      <option value="لاکرا (اسپندکس)">لاکرا (اسپندکس)</option>
                      <option value="کش لاستیکی / کش کاغذی">کش لاستیکی / کش کاغذی</option>
                      <option value="نخ POY">نخ POY</option>
                      <option value="نخ ساپورت">نخ ساپورت</option>
                      <option value="سایر کالاها">سایر کالاها / مشاوره فنی</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      مقدار تقریبی / کارتن
                    </label>
                    <input
                      type="text"
                      value={orderForm.quantity}
                      onChange={(e) => setOrderForm({ ...orderForm, quantity: e.target.value })}
                      placeholder="مثال: ۵ کارتن (۲۰۰ کیلو)"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      توضیحات تکمیلی (اختیاری)
                    </label>
                    <textarea
                      rows={2}
                      value={orderForm.notes}
                      onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })}
                      placeholder="رنگ، گرید یا شروط تحویل..."
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveOrderModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    disabled={submittingOrder}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-md active:scale-95 disabled:opacity-50"
                  >
                    {submittingOrder ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    <span>ثبت و ارسال درخواست</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
