/* ============================================================
   FINANCESAPP — firebase.js
   Único ponto de inicialização e comunicação com o Firebase
   (Auth, Firestore, Storage). Expõe window.firebaseAuth,
   window.firebaseDb, window.firebaseStorage e window.firebaseFns
   para os demais módulos consumirem — nenhum outro arquivo deve
   chamar o SDK do Firebase diretamente.
   Precisa continuar como <script type="module"> (é o único
   arquivo com "import"; os demais são <script> normais).
   ============================================================ */

    import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
    import {
      getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged,
      sendPasswordResetEmail, sendEmailVerification, updateProfile, deleteUser
    } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
    import {
      getFirestore, collection, addDoc, getDocs, getDoc, doc, deleteDoc, updateDoc, setDoc, query, orderBy
    } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
    import {
      getStorage, ref, uploadBytes, getDownloadURL, deleteObject
    } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

    const firebaseConfig = {
      apiKey: "AIzaSyAkUPETgZTo2pkec3lOqx8NXSwkIpaM9Tg",
      authDomain: "financesapp202000.firebaseapp.com",
      databaseURL: "https://financesapp202000-default-rtdb.firebaseio.com",
      projectId: "financesapp202000",
      storageBucket: "financesapp202000.firebasestorage.app",
      messagingSenderId: "482223251544",
      appId: "1:482223251544:web:161f7287db7008a13e6a2d"
    };

    const app     = initializeApp(firebaseConfig);
    const auth    = getAuth(app);
    const db      = getFirestore(app);
    const storage = getStorage(app);

    window.firebaseAuth    = auth;
    window.firebaseDb      = db;
    window.firebaseStorage = storage;
    window.firebaseFns  = {
      signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged,
      sendPasswordResetEmail, sendEmailVerification, updateProfile, deleteUser,
      collection, addDoc, getDocs, getDoc, doc, deleteDoc, updateDoc, setDoc, query, orderBy,
      ref, uploadBytes, getDownloadURL, deleteObject
    };

    onAuthStateChanged(auth, async (user) => {
      if (user) {
        window.currentUser = user;
        // Enquanto o Wizard (Quiz de configuração inicial) estiver aberto,
        // não interrompe nada — ele só abre DEPOIS do e-mail confirmado.
        if (window._wizardEmAndamento) return;

        if (!user.emailVerified) {
          document.getElementById('login-screen').style.display = 'flex';
          document.getElementById('app').style.display = 'none';
          window.showVerificacao?.();
          return;
        }

        // E-mail confirmado: garante que o Quiz já foi concluído antes de
        // liberar o acesso ao app. Cobre tanto o cadastro novo quanto um
        // login normal de uma conta que verificou o e-mail mas, por algum
        // motivo, não chegou a terminar o Quiz.
        try {
          const snap = await getDoc(doc(db, 'users', user.uid));
          const quizConcluido = snap.exists() && !!snap.data().quizConcluido;
          if (!quizConcluido && typeof window.abrirWizardExistente === 'function') {
            document.getElementById('login-screen').style.display = 'flex';
            document.getElementById('app').style.display = 'none';
            window.abrirWizardExistente(user);
            return;
          }
        } catch (e) { /* se a checagem falhar, segue o fluxo padrão abaixo */ }

        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app').style.display = 'flex';
        window.appInit();
      } else {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('app').style.display = 'none';
        window.currentUser = null;
        window.showLogin?.();
      }
    });
