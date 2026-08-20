"use client";

import { createContext, useContext, useEffect, useState } from "react";

const translations = {
  en: {
    // Nav
    home: "Home",
    attractions: "Attractions",
    addAttraction: "+ Add Attraction",
    map: "Map",
    travellers: "Travellers",
    community: "Community",
    myProfile: "My Profile",
    logout: "Logout",
    signIn: "Sign in",
    menu: "Menu",

    // Home hero
    heroEyebrow: "Explore Melaka with the community",
    heroTitle: "Discover attractions and record your travel journey",
    heroSubtitle:
      "Browse popular and lesser-known attractions, read traveller experiences and start exploring Melaka.",

    // Search / filters
    searchAttractions: "Search Attractions",
    searchPlaceholder: "Search attractions in Melaka",
    moreFilters: "More Filters",
    hideFilters: "Hide Filters",
    search: "Search",
    reset: "Reset",
    minimumRating: "Minimum Rating",
    anyRating: "Any Rating",
    ratingAndAbove: "and above",
    locationArea: "Location Area",
    allAreas: "All Areas",
    sortBy: "Sort by",
    sortNameAsc: "Name (A-Z)",
    sortRating: "Rating",
    sortNewest: "Newest",
    sortMostReviewed: "Most Reviewed",
    source: "Source",
    allAttractions: "All Attractions",
    communitySubmittedOnly: "Community-submitted only",
    allCategories: "All Categories",
    attractionsAvailable: "{count} attraction(s) available",
    resultsFound: "{count} result(s) found for {criteria}",
    loadingAttractions: "Loading attractions...",
    failedLoadAttractions: "Failed to load attractions. Please try again.",
    noAttractionsFound: "No attractions found",
    tryChangingFilters:
      "Try changing the keyword, category, area, rating, or clear all filters.",
    clearSearchAndFilters: "Clear Search and Filters",
    previous: "Previous",
    next: "Next",
    pageOf: "Page {page} of {total}",
    keyword: "keyword",
    category: "category",
    area: "area",
    rating: "rating",

    // Categories
    cat_All: "All Categories",
    cat_Museum: "Museum",
    cat_Religious: "Religious",
    cat_TouristAttraction: "Tourist Attraction",
    cat_Historical: "Historical",
    cat_Nature: "Nature",
    cat_Entertainment: "Entertainment",
    cat_Gallery: "Gallery",

    // Profile
    editProfile: "Edit Profile",
    displayName: "Display name",
    email: "Email",
    location: "Location",
    bio: "Bio",
    saveChanges: "Save changes",
    cancel: "Cancel",
    saving: "Saving...",
    profileUpdated: "Profile updated successfully!",
    memberSince: "Member since",
    placesVisited: "Places visited",
    reviewsWritten: "Reviews written",
    photosUploaded: "Photos uploaded",
    savedPlaces: "Saved places",
    yourCollection: "Your Collection",
    wishlist: "Wishlist",
    favourites: "Favourites",
    myReviews: "My Reviews",
    myPhotos: "My Photos",
    travelHistory: "Travel History",
    recentReviews: "Recent Reviews",
    noReviewsYet: "You haven't written any reviews yet.",
    youHaveReviews: "You have {count} reviews.",
    loading: "Loading...",
    locationLabel: "Location",
    itemsSaved: "items saved",
    reviewsWrittenCount: "reviews written",
    photosUploadedCount: "photos uploaded",
    view: "View",
    locationPlaceholder: "City or region you explore from",
    bioPlaceholder: "A short introduction shown on your public profile",
    fileTooLarge: "File is too large. Maximum size is 5MB.",
    unsupportedFormat: "Unsupported file format. Please upload JPG, PNG, or WEBP.",
    uploadHint: "JPG, PNG or WEBP, max 5MB",
  },

  zh: {
    home: "首页",
    attractions: "景点",
    addAttraction: "+ 添加景点",
    map: "地图",
    travellers: "旅人",
    community: "社区",
    myProfile: "我的资料",
    logout: "登出",
    signIn: "登录",
    menu: "菜单",

    heroEyebrow: "与社区一起探索马六甲",
    heroTitle: "发现景点，记录你的旅行足迹",
    heroSubtitle:
      "浏览热门与小众景点，阅读旅人分享，开始探索马六甲。",

    searchAttractions: "搜索景点",
    searchPlaceholder: "在马六甲搜索景点",
    moreFilters: "更多筛选",
    hideFilters: "收起筛选",
    search: "搜索",
    reset: "重置",
    minimumRating: "最低评分",
    anyRating: "不限评分",
    ratingAndAbove: "及以上",
    locationArea: "区域",
    allAreas: "全部区域",
    sortBy: "排序方式",
    sortNameAsc: "名称 (A-Z)",
    sortRating: "评分",
    sortNewest: "最新",
    sortMostReviewed: "评价最多",
    source: "来源",
    allAttractions: "全部景点",
    communitySubmittedOnly: "仅社区提交",
    allCategories: "全部分类",
    attractionsAvailable: "共 {count} 个景点",
    resultsFound: "找到 {count} 个结果：{criteria}",
    loadingAttractions: "正在加载景点...",
    failedLoadAttractions: "加载景点失败，请重试。",
    noAttractionsFound: "未找到景点",
    tryChangingFilters: "请尝试更改关键词、分类、区域、评分，或清除所有筛选。",
    clearSearchAndFilters: "清除搜索与筛选",
    previous: "上一页",
    next: "下一页",
    pageOf: "第 {page} / {total} 页",
    keyword: "关键词",
    category: "分类",
    area: "区域",
    rating: "评分",

    cat_All: "全部分类",
    cat_Museum: "博物馆",
    cat_Religious: "宗教",
    cat_TouristAttraction: "旅游景点",
    cat_Historical: "历史",
    cat_Nature: "自然",
    cat_Entertainment: "娱乐",
    cat_Gallery: "画廊",

    editProfile: "编辑资料",
    displayName: "显示名称",
    email: "邮箱",
    location: "所在地",
    bio: "简介",
    saveChanges: "保存修改",
    cancel: "取消",
    saving: "保存中...",
    profileUpdated: "资料更新成功！",
    memberSince: "加入于",
    placesVisited: "已访问地点",
    reviewsWritten: "已写评价",
    photosUploaded: "已上传照片",
    savedPlaces: "已收藏地点",
    yourCollection: "我的收藏",
    wishlist: "心愿单",
    favourites: "收藏",
    myReviews: "我的评价",
    myPhotos: "我的照片",
    travelHistory: "旅行历史",
    recentReviews: "最近评价",
    noReviewsYet: "你还没有写过任何评价。",
    youHaveReviews: "你有 {count} 条评价。",
    loading: "加载中...",
    locationLabel: "所在地",
    itemsSaved: "项已保存",
    reviewsWrittenCount: "条评价",
    photosUploadedCount: "张照片",
    view: "查看",
    locationPlaceholder: "你常探索的城市或地区",
    bioPlaceholder: "展示在公开资料上的简短介绍",
    fileTooLarge: "文件过大，最大 5MB。",
    unsupportedFormat: "不支持的格式，请上传 JPG、PNG 或 WEBP。",
    uploadHint: "JPG、PNG 或 WEBP，最大 5MB",
  },

  ms: {
    home: "Laman Utama",
    attractions: "Tarikan",
    addAttraction: "+ Tambah Tarikan",
    map: "Peta",
    travellers: "Pengembara",
    community: "Komuniti",
    myProfile: "Profil Saya",
    logout: "Log Keluar",
    signIn: "Log Masuk",
    menu: "Menu",

    heroEyebrow: "Terokai Melaka bersama komuniti",
    heroTitle: "Temui tarikan dan rekod perjalanan anda",
    heroSubtitle:
      "Layari tarikan popular dan tersembunyi, baca pengalaman pengembara dan mula terokai Melaka.",

    searchAttractions: "Cari Tarikan",
    searchPlaceholder: "Cari tarikan di Melaka",
    moreFilters: "Lagi Penapis",
    hideFilters: "Sembunyikan Penapis",
    search: "Cari",
    reset: "Set Semula",
    minimumRating: "Penilaian Minimum",
    anyRating: "Sebarang Penilaian",
    ratingAndAbove: "dan ke atas",
    locationArea: "Kawasan",
    allAreas: "Semua Kawasan",
    sortBy: "Susun mengikut",
    sortNameAsc: "Nama (A-Z)",
    sortRating: "Penilaian",
    sortNewest: "Terbaharu",
    sortMostReviewed: "Paling Banyak Diulas",
    source: "Sumber",
    allAttractions: "Semua Tarikan",
    communitySubmittedOnly: "Hanya diserahkan komuniti",
    allCategories: "Semua Kategori",
    attractionsAvailable: "{count} tarikan tersedia",
    resultsFound: "{count} keputusan dijumpai untuk {criteria}",
    loadingAttractions: "Memuatkan tarikan...",
    failedLoadAttractions: "Gagal memuatkan tarikan. Sila cuba lagi.",
    noAttractionsFound: "Tiada tarikan dijumpai",
    tryChangingFilters:
      "Cuba ubah kata kunci, kategori, kawasan, penilaian, atau kosongkan semua penapis.",
    clearSearchAndFilters: "Kosongkan Carian dan Penapis",
    previous: "Sebelum",
    next: "Seterusnya",
    pageOf: "Halaman {page} daripada {total}",
    keyword: "kata kunci",
    category: "kategori",
    area: "kawasan",
    rating: "penilaian",

    cat_All: "Semua Kategori",
    cat_Museum: "Muzium",
    cat_Religious: "Agama",
    cat_TouristAttraction: "Tarikan Pelancong",
    cat_Historical: "Sejarah",
    cat_Nature: "Alam",
    cat_Entertainment: "Hiburan",
    cat_Gallery: "Galeri",

    editProfile: "Edit Profil",
    displayName: "Nama paparan",
    email: "E-mel",
    location: "Lokasi",
    bio: "Bio",
    saveChanges: "Simpan perubahan",
    cancel: "Batal",
    saving: "Menyimpan...",
    profileUpdated: "Profil berjaya dikemas kini!",
    memberSince: "Ahli sejak",
    placesVisited: "Tempat dilawati",
    reviewsWritten: "Ulasan ditulis",
    photosUploaded: "Foto dimuat naik",
    savedPlaces: "Tempat disimpan",
    yourCollection: "Koleksi Anda",
    wishlist: "Senarai Hajat",
    favourites: "Kegemaran",
    myReviews: "Ulasan Saya",
    myPhotos: "Foto Saya",
    travelHistory: "Sejarah Perjalanan",
    recentReviews: "Ulasan Terkini",
    noReviewsYet: "Anda belum menulis sebarang ulasan.",
    youHaveReviews: "Anda mempunyai {count} ulasan.",
    loading: "Memuatkan...",
    locationLabel: "Lokasi",
    itemsSaved: "item disimpan",
    reviewsWrittenCount: "ulasan ditulis",
    photosUploadedCount: "foto dimuat naik",
    view: "Lihat",
    locationPlaceholder: "Bandar atau kawasan yang anda terokai",
    bioPlaceholder: "Pengenalan ringkas pada profil awam anda",
    fileTooLarge: "Fail terlalu besar. Maksimum 5MB.",
    unsupportedFormat: "Format tidak disokong. Sila muat naik JPG, PNG, atau WEBP.",
    uploadHint: "JPG, PNG atau WEBP, maks 5MB",
  },
};

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState("en");

  useEffect(() => {
    const saved = localStorage.getItem("chatlas-lang");
    if (saved && translations[saved]) {
      setLang(saved);
    }
  }, []);

  const changeLang = (newLang) => {
    if (!translations[newLang]) return;
    setLang(newLang);
    localStorage.setItem("chatlas-lang", newLang);
  };

  const t = (key, vars = {}) => {
    let text = translations[lang]?.[key] || translations.en[key] || key;
    Object.keys(vars).forEach((k) => {
      text = text.replaceAll(`{${k}}`, String(vars[k]));
    });
    return text;
  };

  const translateCategory = (name) => {
    if (!name || name === "All") return t("cat_All");
    const key = `cat_${name.replace(/\s+/g, "")}`;
    return t(key) !== key ? t(key) : name;
  };

  return (
    <LanguageContext.Provider value={{ lang, changeLang, t, translateCategory }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return ctx;
}
