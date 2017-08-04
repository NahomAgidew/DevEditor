$(function () {
    var config = {
        apiKey: "AIzaSyDDrvhMoAoBFWndtjaxQrhM1a-G-rED71Q",
        authDomain: "deveditor-b0aff.firebaseapp.com",
        databaseURL: "https://deveditor-b0aff.firebaseio.com",
        projectId: "deveditor-b0aff",
        storageBucket: "",
        messagingSenderId: "979324417934"
    };
    firebase.initializeApp(config);

    // Get the editor id, using Url.js
    // Default to "_" for users who do not have a custom id
    var editorId = Url.queryString("id") || "_";

    var LS_THEME_KEY = "editor-theme";

    function getTheme() {
        return localStorage.getItem(LS_THEME_KEY) || "ace/theme/monokai";
    }

    $("#select-theme").change(function() {
        editor.setTheme(this.value);

        try {
            localStorage.setItem(LS_THEME_KEY, this.value);
        } catch(e) {}
    }).val(getTheme());

    var $selectLang = $("#select-lang").change(function() {
        currentEditorValue.update({
            lang: this.value
        });

        editor.getSession().setMode(`ace/mode/${this.value}`);
    });

    // Generate a pseudo user id
    // This will be used to know if it's me the one who updated
    // the code or not
    var uid = Math.random().toString();
    var editor = null;
    var db = firebase.database();
    var editorValues = db.ref("editor_values");
    var currentEditorValue = editorValues.child(editorId);

    var openPageTimeStamp = Date.now();

    currentEditorValue.child("content").once("value", function(contentRef) {
        currentEditorValue.child("lang").on("value", function(r) {
            var value = r.val();
            var cLang = $selectLang.val();
            if(cLang !== value) {
                $selectLang.val(value).change();
            }
        });

        // Hide the spinner
        $("#loader").fadeOut();
        $("#editor").fadeIn();

        //Init the ACE editor
        editor = ace.edit("editor");
        editor.setTheme(getTheme());
        editor.$blockScrolling = Infinity;

        var queueRef = currentEditorValue.child("queue");

        var applyingDeltas = false;

        // When we change something in the editor, update the value in Firebase
        editor.on("change", function(e) {
            // this boolean becomes `true` when we receive data from Firebase
            if(applyingDeltas) {
                return;
            }

            // This is being used for new users, not for already-joined users.
            currentEditorValue.update({
                content: editor.getValue()
            });

            queueRef.child(`${Date.now().toString()}:${Math.random().toString().slice(2)}`).set({
                event: e,
                by: uid
            }).catch(function(e) {
                console.error(e);
            });
        });

        var doc = editor.getSession().getDocument();

        // Listen for updates
        queueRef.on("child_added", function(ref) {
            var timestamp = ref.key.split(":")[0];
            // Do not apply changes from the past
            if (openPageTimestamp > timestamp) {
                return;
            }

            var value = ref.val();

            // In case it's me who changed the value, I am
            // not interested to see twice what I'm writing.
            // So, if the update is made by me, it doesn't
            // make sense to apply the update
            if (value.by === uid) { return; }

            applyingDeltas = true;
            doc.applyingDeltas([value.event]);
            applyingDeltas = false;
        });

        var val = contentRef.val();

        // If the editor doesn't exist already....
        if(val === null) {
            val = "";
            editorValues.child(editorId).set({
                lang: "javascript",
                queue: {},
                content: val
            });
        }

        applyingDeltas = true;

        // -1 will move the cursor at the begining of the editor, preventing
        // selecting all the code in the editor (which is happening by default)
        editor.setValue(val, -1);

        applyingDeltas = false;

        editor.focus();
    });
});