import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, getDoc, setDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { Mail, Send, User, Lock, Inbox, AlertCircle, CheckCircle2, Users, LogOut, KeyRound } from 'lucide-react';

// --- INISIALISASI FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyDdgjmvgpdbia0vyCP0ImYLazmyreEfVoM",
  authDomain: "secretmessagekkn.firebaseapp.com",
  projectId: "secretmessagekkn",
  storageBucket: "secretmessagekkn.firebasestorage.app",
  messagingSenderId: "782535348090",
  appId: "1:782535348090:web:91d27378d8217a4c58d0c3",
  measurementId: "G-8RTB9ZC3PW"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = "kkn-rahasia"; // Nama folder di database (bebas)

export default function App() {
  // State Autentikasi Sistem
  const [systemUser, setSystemUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  // State Sesi KKN (Custom Login)
  const [activeKknUser, setActiveKknUser] = useState(null); 
  
  // State Data
  const [usersList, setUsersList] = useState([]);
  const [messagesList, setMessagesList] = useState([]);
  
  // State UI
  const [view, setView] = useState('inbox'); 
  const [authMode, setAuthMode] = useState('login'); 
  const [notification, setNotification] = useState(null);

  // Form State
  const [usernameInput, setUsernameInput] = useState('');
  const [pinInput, setPinInput] = useState('');
  
  const [targetUsername, setTargetUsername] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [senderNameInput, setSenderNameInput] = useState(''); // STATE BARU UNTUK NAMA PENGIRIM

  // 1. Setup Firebase Auth
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth); // Cukup sisakan baris ini saja
      } catch (error) {
        console.error("Auth error:", error);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setSystemUser(user);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 2. Ambil Data Realtime
  useEffect(() => {
    if (!systemUser) return;

    const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'kkn_users');
    const messagesRef = collection(db, 'artifacts', appId, 'public', 'data', 'kkn_messages');

    // Listener Daftar User
    const unsubscribeUsers = onSnapshot(usersRef, (snapshot) => {
      const usersData = [];
      snapshot.forEach((doc) => {
        usersData.push({ id: doc.id, ...doc.data() });
      });
      setUsersList(usersData);
    }, (error) => console.error("Error fetching users:", error));

    // Listener Daftar Pesan
    const unsubscribeMessages = onSnapshot(messagesRef, (snapshot) => {
      const msgsData = [];
      snapshot.forEach((doc) => {
        msgsData.push({ id: doc.id, ...doc.data() });
      });
      msgsData.sort((a, b) => {
        const timeA = a.timestamp?.toMillis() || 0;
        const timeB = b.timestamp?.toMillis() || 0;
        return timeB - timeA;
      });
      setMessagesList(msgsData);
    }, (error) => console.error("Error fetching messages:", error));

    return () => {
      unsubscribeUsers();
      unsubscribeMessages();
    };
  }, [systemUser, appId]);

  const showNotification = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // --- LOGIC AUTHENTICATION KKN ---
  const handleRegister = async (e) => {
    e.preventDefault();
    const uname = usernameInput.trim().toLowerCase();
    const pin = pinInput.trim();

    if (!uname || !pin) {
      showNotification('Username dan PIN tidak boleh kosong!', 'error');
      return;
    }
    if (uname.includes(' ')) {
      showNotification('Username tidak boleh pakai spasi!', 'error');
      return;
    }

    try {
      const userDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'kkn_users', uname);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        showNotification('Username ini sudah dipakai anggota lain!', 'error');
      } else {
        await setDoc(userDocRef, {
          username: uname,
          pin: pin,
          createdAt: serverTimestamp()
        });
        showNotification('Akun berhasil dibuat! Silakan masuk.');
        setAuthMode('login');
        setPinInput('');
      }
    } catch (error) {
      console.error("Register error:", error);
      showNotification('Terjadi kesalahan saat mendaftar.', 'error');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const uname = usernameInput.trim().toLowerCase();
    const pin = pinInput.trim();

    if (!uname || !pin) return;

    try {
      const userDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'kkn_users', uname);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        if (userData.pin === pin) {
          setActiveKknUser({ username: userData.username });
          setUsernameInput('');
          setPinInput('');
          setView('inbox');
          showNotification(`Selamat datang kembali, ${userData.username}!`);
        } else {
          showNotification('PIN salah! Coba ingat-ingat lagi.', 'error');
        }
      } else {
        showNotification('Username tidak ditemukan. Daftar dulu ya!', 'error');
      }
    } catch (error) {
      console.error("Login error:", error);
      showNotification('Terjadi kesalahan saat login.', 'error');
    }
  };

  const handleLogout = () => {
    setActiveKknUser(null);
    setView('inbox');
    showNotification('Berhasil keluar akun.');
  };

  // --- LOGIC KIRIM PESAN ---
  const handleSendMessage = async (e) => {
    e.preventDefault();
    const target = targetUsername.trim().toLowerCase();
    const msg = messageInput.trim();
    // Jika input nama pengirim kosong, set sebagai 'Anonim'
    const sender = senderNameInput.trim() || 'Anonim';

    if (!target || !msg) {
      showNotification('Isi username tujuan dan pesannya!', 'error');
      return;
    }

    const targetExists = usersList.some(u => u.username === target);
    if (!targetExists) {
      showNotification(`Anggota dengan username "${target}" tidak ditemukan.`, 'error');
      return;
    }
    if (target === activeKknUser.username) {
      showNotification('Masa kirim pesan buat diri sendiri? 😅', 'error');
      return;
    }

    try {
      const messagesRef = collection(db, 'artifacts', appId, 'public', 'data', 'kkn_messages');
      await addDoc(messagesRef, {
        to_username: target,
        message: msg,
        sender_name: sender, // Menyimpan nama pengirim/anonim
        timestamp: serverTimestamp()
      });
      
      setMessageInput('');
      setTargetUsername('');
      setSenderNameInput(''); // Reset nama pengirim
      showNotification(`Pesan berhasil dikirim ke ${target}! 💌`);
      setView('inbox');
    } catch (error) {
      console.error("Send error:", error);
      showNotification('Gagal mengirim pesan.', 'error');
    }
  };

  const myMessages = messagesList.filter(msg => msg.to_username === activeKknUser?.username);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-teal-50 flex items-center justify-center font-sans">
        <div className="animate-pulse text-teal-600 font-semibold">Menyiapkan Aplikasi...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col">
      {/* HEADER */}
      <header className="bg-teal-700 text-white shadow-md sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Mail className="h-6 w-6 text-teal-200" />
            <h1 className="text-lg font-bold tracking-wide">Pesan KKN</h1>
          </div>
          {activeKknUser && (
            <button 
              onClick={handleLogout}
              className="flex items-center space-x-1 bg-teal-800 hover:bg-teal-900 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span>Keluar</span>
            </button>
          )}
        </div>
      </header>

      {/* NOTIFIKASI TOAST */}
      {notification && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 w-[90%] max-w-sm animate-in fade-in slide-in-from-top-2">
          <div className={`p-4 rounded-xl shadow-lg flex items-center space-x-3 text-white ${
            notification.type === 'success' ? 'bg-teal-600' : 'bg-rose-500'
          }`}>
            {notification.type === 'success' ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
            <p className="font-medium text-sm leading-tight">{notification.msg}</p>
          </div>
        </div>
      )}

      {/* KONTEN UTAMA */}
      <main className="flex-1 max-w-md mx-auto w-full p-4 mb-20 md:mb-4 relative">
        
        {/* LAYAR AUTH */}
        {!activeKknUser && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mt-4">
            <div className="flex border-b border-slate-100">
              <button 
                onClick={() => setAuthMode('login')}
                className={`flex-1 py-4 text-sm font-bold text-center transition-colors ${authMode === 'login' ? 'bg-teal-50 text-teal-700 border-b-2 border-teal-600' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                Masuk
              </button>
              <button 
                onClick={() => setAuthMode('register')}
                className={`flex-1 py-4 text-sm font-bold text-center transition-colors ${authMode === 'register' ? 'bg-teal-50 text-teal-700 border-b-2 border-teal-600' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                Buat Akun
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="text-center">
                <div className="mx-auto w-12 h-12 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center mb-3">
                  {authMode === 'login' ? <Lock className="h-6 w-6" /> : <User className="h-6 w-6" />}
                </div>
                <h2 className="text-xl font-bold text-slate-800">
                  {authMode === 'login' ? 'Selamat Datang Kembali!' : 'Daftar Anggota Baru'}
                </h2>
                <p className="text-slate-500 text-sm mt-1">
                  {authMode === 'login' ? 'Masukkan username dan PIN-mu.' : 'Buat username unik tanpa spasi.'}
                </p>
              </div>

              <form onSubmit={authMode === 'login' ? handleLogin : handleRegister} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">Username</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="contoh: joko_kkn"
                      value={usernameInput}
                      onChange={(e) => setUsernameInput(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">PIN Rahasia</label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <input
                      type="password"
                      placeholder="Buat PIN sederhana (misal: 1234)"
                      value={pinInput}
                      onChange={(e) => setPinInput(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
                      required
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-sm mt-2"
                >
                  {authMode === 'login' ? 'Masuk Sekarang' : 'Daftar Akun'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* DASHBOARD */}
        {activeKknUser && (
          <div className="space-y-6">
            
            {/* TAMPILAN INBOX */}
            {view === 'inbox' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500 uppercase font-bold tracking-wide">Login sebagai</p>
                    <p className="font-bold text-lg text-teal-700">@{activeKknUser.username}</p>
                  </div>
                  <div className="bg-teal-100 text-teal-800 text-sm font-bold px-3 py-1 rounded-full">
                    {myMessages.length} Pesan
                  </div>
                </div>

                <h2 className="text-lg font-bold text-slate-800 mb-3 flex items-center">
                  <Inbox className="h-5 w-5 mr-2 text-teal-600" />
                  Kotak Masukmu
                </h2>

                {myMessages.length === 0 ? (
                  <div className="bg-white p-8 rounded-2xl text-center border border-slate-200 border-dashed">
                    <Mail className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                    <h3 className="font-bold text-slate-700">Belum ada pesan</h3>
                    <p className="text-sm text-slate-500 mt-1">Coba kabari teman-temanmu untuk mengirim pesan ke <span className="font-bold text-teal-600">@{activeKknUser.username}</span></p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {myMessages.map((msg) => (
                      <div key={msg.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-teal-500"></div>
                        <div className="flex justify-between items-start mb-2">
                          
                          {/* Logika Tampilan Badge Pengirim */}
                          <span className={`text-xs px-2 py-1 rounded font-semibold flex items-center ${
                            msg.sender_name === 'Anonim' ? 'bg-slate-100 text-slate-600' : 'bg-teal-50 text-teal-700'
                          }`}>
                            {msg.sender_name === 'Anonim' ? <Lock className="w-3 h-3 mr-1"/> : <User className="w-3 h-3 mr-1"/>}
                            {msg.sender_name === 'Anonim' ? 'Pesan Anonim' : `Dari: ${msg.sender_name}`}
                          </span>

                          <span className="text-xs font-medium text-slate-400">
                            {msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleDateString('id-ID') : 'Baru saja'}
                          </span>
                        </div>
                        <p className="text-slate-700 mt-2 text-[15px] leading-relaxed whitespace-pre-wrap">
                          "{msg.message}"
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAMPILAN KIRIM PESAN */}
            {view === 'send' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                <h2 className="text-lg font-bold text-slate-800 mb-3 flex items-center">
                  <Send className="h-5 w-5 mr-2 text-teal-600" />
                  Kirim Pesan
                </h2>

                <form onSubmit={handleSendMessage} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Username Tujuan</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 font-bold">@</span>
                      <input
                        type="text"
                        placeholder="Ketik username temanmu..."
                        value={targetUsername}
                        onChange={(e) => setTargetUsername(e.target.value)}
                        className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Dari Siapa? (Opsional)</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Kosongkan jika ingin anonim..."
                        value={senderNameInput}
                        onChange={(e) => setSenderNameInput(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 ml-1">Jika dikosongkan, nama pengirim akan muncul sebagai <b>Anonim</b>.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Isi Pesan</label>
                    <textarea
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      placeholder="Tulis kesan, pesan, atau kejujuranmu di sini..."
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 h-32 resize-none text-[15px]"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 px-4 rounded-xl transition-colors flex items-center justify-center shadow-md"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Kirim Pesan
                  </button>
                </form>
              </div>
            )}

            {/* TAMPILAN DAFTAR ANGGOTA */}
            {view === 'users' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                <h2 className="text-lg font-bold text-slate-800 mb-3 flex items-center">
                  <Users className="h-5 w-5 mr-2 text-teal-600" />
                  Buku Anggota KKN
                </h2>
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  {usersList.length === 0 ? (
                     <div className="p-6 text-center text-slate-500 text-sm">Belum ada anggota yang mendaftar.</div>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {usersList.map(u => (
                        <li key={u.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                          <div className="flex items-center space-x-3">
                            <div className="bg-teal-100 p-2 rounded-full text-teal-600">
                              <User className="h-5 w-5" />
                            </div>
                            <span className="font-bold text-slate-700">@{u.username}</span>
                          </div>
                          {u.username !== activeKknUser.username && (
                            <button 
                              onClick={() => {
                                setTargetUsername(u.username);
                                setView('send');
                              }}
                              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold px-3 py-1.5 rounded-lg transition-colors"
                            >
                              Kirim Pesan
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* NAVIGASI BAWAH */}
      {activeKknUser && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 pb-safe z-40 md:relative md:border-none md:bg-transparent md:max-w-md md:mx-auto md:mb-8">
          <div className="flex justify-around items-center p-2 md:bg-white md:rounded-2xl md:shadow-sm md:border md:border-slate-200 md:p-3">
            <button
              onClick={() => setView('inbox')}
              className={`flex flex-col items-center p-2 rounded-xl flex-1 transition-colors ${
                view === 'inbox' ? 'text-teal-600' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Inbox className="h-6 w-6 mb-1" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Kotak Masuk</span>
            </button>
            <button
              onClick={() => setView('send')}
              className={`flex flex-col items-center p-2 rounded-xl flex-1 transition-colors ${
                view === 'send' ? 'text-teal-600' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Send className="h-6 w-6 mb-1" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Kirim Pesan</span>
            </button>
            <button
              onClick={() => setView('users')}
              className={`flex flex-col items-center p-2 rounded-xl flex-1 transition-colors ${
                view === 'users' ? 'text-teal-600' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Users className="h-6 w-6 mb-1" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Anggota</span>
            </button>
          </div>
        </nav>
      )}

    </div>
  );
}