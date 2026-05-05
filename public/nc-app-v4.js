/**
 * NC-APP-V4.js — ZENMIX Application Controller
 * Routing, rendering, themes, and integration layer for all ZENMIX v4 modules.
 *
 * @module nc-app-v4
 * @version 4.0.0
 * @description Main application controller for ZENMIX hypnosis app
 *
 * Architecture:
 *   - 5 views: home, session, custom, record, stats
 *   - View Transitions API for page changes
 *   - Dynamic component rendering
 *   - Event delegation for performance
 *   - Dark/Light theme with localStorage persistence
 *   - PF (PixelForge) CSS class integration
 *   - Pub/sub event bus connecting audio engine ↔ data layer ↔ UI
 *
 * Dependencies:
 *   - nc-data-v4.js (register first)
 *   - nc-audio-v4.js (register second)
 *   - nc-app-v4.js (register last)
 *
 * Usage:
 *   <script type="module" src="nc-data-v4.js"></script>
 *   <script type="module" src="nc-audio-v4.js"></script>
 *   <script type="module" src="nc-app-v4.js"></script>
 *   <!-- App mounts to #zenmix-app -->
 *   <div id="zenmix-app"></div>
 */

'use strict';

(function () {
    // ================================================================
    // EMBEDDED HYPNOSIS SCRIPTS (7 complete scripts, 200+ words each)
    // ================================================================

    /** @type {Object<string, string>} */
    const EMBEDDED_SCRIPTS = {
        insomnio: [
            "Duerme profundamente... Cierra tus ojos lentamente, con suavidad, como si tus párpados fueran cortinas de terciopelo que caen sobre el escenario de tu mente. Cada parpadeo te lleva más y más profundo hacia un estado de paz absoluta.",
            "Siente cómo tu respiración se vuelve lenta y pesada. Inhala... uno, dos, tres, cuatro... y exhala... uno, dos, tres, cuatro, cinco, seis... Deja que el aire entre como una brisa cálida de verano y salga llevándose toda la tensión de tu día.",
            "Ahora, dirige tu atención a tus pies. Imagina que una ola de calor dorado comienza a subir desde la planta de tus pies... Es una sensación de hormigueo agradable, de relajación profunda. Tus dedos se aflojan, tus tobillos se liberan de toda presión.",
            "Esa ola de calor sube por tus pantorrillas... tus rodillas... tus muslos... Cada músculo se derrite, se disuelve, se convierte en agua tibia que fluye y descansa. Tus piernas se sienten tan pesadas, tan cómodas, tan profundamente relajadas.",
            "El calor dorado llega ahora a tu abdomen. Siente cómo tu estómago se relaja. Todos los órganos de tu cuerpo están funcionando en perfecta armonía mientras tú simplemente flotas... flotas en un océano de tranquilidad infinita.",
            "La ola de relajación sube por tu pecho. Tu corazón late suave, rítmicamente. Cada latido es una ola más que te arrulla, que te mece, que te lleva más profundo... más profundo... Hacia el sueño reparador que tanto mereces.",
            "Ahora tus hombros... Siente cómo dejas caer todo el peso del mundo de tus hombros. Cualquier preocupación, cualquier pendiente, cualquier pensamiento del día... simplemente se desvanece, se disuelve como neblina al amanecer.",
            "Tus brazos se vuelven increíblemente pesados. Tus manos descansan, tus dedos se relajan uno por uno. El pulgar... el índice... el medio... el anular... el meñique... Cada dedo libera su tensión y se hunde en la suavidad de tu cama.",
            "La ola dorada acaricia ahora tu cuello, tu nuca, liberando nudos que ni siquiera sabías que existían. Tu garganta se abre, tu mandíbula se desbloquea, tus labios se separan ligeramente. Toda tensión facial desaparece.",
            "Tu frente se alisa como la superficie de un lago en calma. Tus cejas dejan de fruncirse. Los músculos alrededor de tus ojos se relajan completamente. Tus ojos descansan detrás de tus párpados cerrados, flotando en la oscuridad acogedora.",
            "Ahora todo tu cuerpo está cubierto por esta manta dorada de relajación absoluta. Estás flotando en una nube suave, cálida, segura. Nada te molesta, nada te preocupa. Solo existe este momento de paz infinita.",
            "Voy a contar del diez al uno, y con cada número te hundirás el doble de profundo en el sueño más reparador que hayas experimentado jamás. Diez... flotando hacia abajo... Nueve... cada vez más profundo... Ocho... sintiendo cómo el sueño te envuelve...",
            "Siete... tu mente se aquieta... Seis... los pensamientos se disuelven... Cinco... solo paz... Cuatro... entrando al santuario del sueño... Tres... casi llegando... Dos... completamente entregado... Uno... duerme profundamente, dulcemente, hasta que tu cuerpo esté completamente renovado."
        ].join('\n'),

        ansiedad: [
            "Libera la ansiedad... Comencemos con una respiración profunda. Inhala lentamente contando hasta cuatro... uno... dos... tres... cuatro... Ahora sostén el aire... uno... dos... tres... cuatro... Y exhala suavemente... uno... dos... tres... cuatro... cinco... seis...",
            "Otra vez. Inhala la calma... uno... dos... tres... cuatro... Sostén esa paz dentro de ti... Y exhala la ansiedad... uno... dos... tres... cuatro... cinco... seis... Siente cómo cada exhalación libera un poco más de tensión acumulada.",
            "La ansiedad es solo energía atrapada en tu cuerpo. Es como una nube pasajera en el cielo inmenso de tu mente. Las nubes vienen... y las nubes se van. Tú eres el cielo, no las nubes. Tú eres vasto, infinito, inmutable.",
            "Ahora visualiza un lugar seguro. Puede ser una playa de arena blanca, un bosque de pinos con el aroma a tierra mojada, o una montaña donde el aire es puro y fresco. Elige tu lugar sagrado... y camina hacia él con cada paso que damos juntos.",
            "En este lugar seguro, no existe la ansiedad. Solo existe el sonido suave de las olas... o del viento entre los árboles... o del silencio absoluto de la cima de una montaña. Este es tu refugio interior, disponible para ti en cualquier momento.",
            "Siente cómo tus pies tocan la arena tibia... o el musgo suave... o la roca firme de la montaña. Cada paso te ancla más al presente. Porque la ansiedad vive en el futuro y en el pasado, pero en el presente... en el ahora... solo existe la paz.",
            "Respira el aire de tu lugar seguro. Está cargado de iones negativos, de oxígeno puro, de vida. Cada inhalación llena tus pulmones de calma líquida. Cada exhalación expulsa un poco más de preocupación fuera de tu sistema.",
            "Ahora, pon tu mano derecha sobre tu pecho, justo encima de tu corazón. Siente sus latidos. Tu corazón ha latido por ti cada segundo de tu vida sin que tuvieras que pedírselo. Es tu aliado más fiel. Dile 'gracias' en silencio.",
            "La ansiedad a veces hace que tu corazón se acelere, pero ahora... ahora está tranquilo. Está en casa. Está seguro. Y tú también lo estás. Repite conmigo en tu mente: 'Estoy a salvo. Estoy en paz. Todo está bien en este momento.'",
            "Visualiza ahora un río de luz azul que entra por la coronilla de tu cabeza. Es una luz fresca, calmante, como el color del cielo al atardecer. Esta luz azul recorre tu cerebro, calmando cada neurona, cada sinapsis, cada pensamiento acelerado.",
            "La luz azul baja por tu garganta, liberando la opresión que a veces sientes cuando la ansiedad aprieta. Baja por tu pecho, refrescando tu corazón. Baja por tu estómago, disolviendo los nudos de tensión. Y sale por tus pies llevándose todo lo que ya no necesitas.",
            "Eres más fuerte que tu ansiedad. Has sobrevivido al cien por ciento de tus días difíciles. Cada vez que la ansiedad ha venido, eventualmente se ha ido. Esta vez no es diferente. Esta vez también pasará. Estás a salvo ahora mismo.",
            "Quédate en tu lugar seguro todo el tiempo que necesites. Puedes volver aquí cuando quieras, con solo cerrar los ojos y respirar tres veces profundamente. Y ahora, lentamente, trayendo contigo toda esta calma, comienza a regresar. Estás en paz."
        ].join('\n'),

        migraña: [
            "Alivia el dolor... Cierra tus ojos con delicadeza, como si estuvieras protegiendo la luz más preciosa del mundo. No necesitas hacer ningún esfuerzo. Tu único trabajo ahora es permitirte recibir alivio y bienestar.",
            "Comienza respirando suave y lentamente. Imagina que cada inhalación trae un aire fresco, mentolado, que refresca y calma todo a su paso. Cada exhalación se lleva un poco del dolor, de la presión, de la incomodidad.",
            "Lleva tu atención a la punta de tus dedos de los pies. Siente un hormigueo agradable, un cosquilleo de energía curativa que comienza a ascender suavemente. Es tu propio cuerpo activando sus mecanismos naturales de sanación.",
            "Esa energía sube por tus piernas como una corriente de agua tibia con propiedades curativas. A su paso, cada músculo, cada tendón, cada célula se relaja y se renueva. La tensión acumulada se disuelve instantáneamente.",
            "Ahora, imagina que sobre tu cabeza flota una esfera de luz violeta sanadora. Es una luz suave, pulsante, viva. Esta luz tiene la capacidad de penetrar suavemente en tu cráneo y masajear las zonas de tensión.",
            "La luz violeta comienza a descender lentamente hacia tu cabeza. Al contacto con tu cuero cabelludo, sientes una agradable sensación de frescura. Es como si una mano invisible y amorosa estuviera acariciando tu cabeza con infinita ternura.",
            "Esta luz sanadora penetra ahora en las capas más profundas de tu cabeza. Llega a los músculos tensos de tu cuello, a la base de tu cráneo. Visualiza cómo estos músculos se aflojan, se desenredan, se liberan de nudos que estaban causando presión.",
            "La luz violeta es inteligente. Sabe exactamente dónde está el dolor. Viaja directamente hacia el origen de la molestia y comienza a trabajar. Cada pulso de luz es como una ola de alivio. Con cada latido de tu corazón, el dolor disminuye un poco más.",
            "Imagina que los vasos sanguíneos de tu cabeza se dilatan suavemente, permitiendo que la sangre fluya libremente, sin presión, sin restricción. La luz violeta guía este flujo, despejando cualquier bloqueo, cualquier estancamiento.",
            "Ahora visualiza cómo de tus sienes emana un calor suave y confortable. Es la señal de que la tensión se está liberando. El dolor que estaba atrapado comienza a disolverse, a evaporarse, a desaparecer como la niebla bajo los primeros rayos del sol.",
            "Lleva tu atención al espacio entre tus cejas. Relaja ese punto. Siente cómo se abre un espacio de paz en el centro de tu frente. Toda la presión craneal comienza a drenar suavemente hacia abajo, saliendo de tu cuerpo a través de tus pies.",
            "Tu cabeza se siente ahora más ligera, más clara, más libre. La luz violeta ha completado su trabajo de sanación. Tu cerebro flota plácidamente en un líquido amniótico de bienestar absoluto. No hay dolor. Solo hay paz, claridad y renovación.",
            "Voy a contar del cinco al uno, y con cada número, regresarás a tu estado normal de conciencia, pero el alivio permanecerá contigo. Cinco... sintiéndote renovado. Cuatro... tu cabeza ligera y clara. Tres... energía positiva fluyendo. Dos... abriendo los ojos lentamente. Uno... completamente presente, sin dolor, en paz."
        ].join('\n'),

        autoestima: [
            "Eres suficiente... Toma una respiración profunda y, al exhalar, deja ir cualquier duda sobre tu valor como persona. Hoy vamos a recordar algo que quizás olvidaste en el camino: lo increíblemente valioso que eres, exactamente como eres.",
            "Pon tu mano sobre tu corazón y siente sus latidos. Ese corazón ha estado contigo desde antes de que nacieras. Ha latido millones de veces solo para mantenerte vivo. Eso significa que eres importante. La vida misma decidió que merecías estar aquí.",
            "Ahora recuerda un momento en el que te sentiste orgulloso de ti mismo. No tiene que ser algo grande. Puede ser cuando ayudaste a alguien sin esperar nada a cambio, o cuando lograste algo que creías imposible. Revive ese sentimiento en tu pecho ahora mismo.",
            "Ese sentimiento de orgullo, de logro, de valía... eso es real. Eso eres tú. No eres tus errores. No eres lo que otros han dicho de ti. Eres la suma de cada acto de bondad, de cada esfuerzo, de cada vez que decidiste seguir adelante a pesar de la dificultad.",
            "Repite conmigo en tu mente: 'Soy suficiente.' No necesitas ser perfecto para ser suficiente. No necesitas cumplir expectativas ajenas. Eres suficiente en este preciso momento. Respira estas palabras: Soy... suficiente.",
            "Visualiza ahora un espejo dorado frente a ti. Pero este no es un espejo común. Este espejo refleja tu luz interior, tu esencia más pura, tu alma. Mira ese reflejo con ojos de compasión y amor incondicional.",
            "En el reflejo ves a alguien que ha superado cosas muy difíciles. Alguien que ha llorado y se ha vuelto a levantar. Alguien que tiene sueños, talentos y una capacidad infinita de amar. Ese alguien eres tú. Y ese alguien merece todo el amor del universo.",
            "Ahora repite estas afirmaciones sintiéndolas profundamente en tu interior: 'Me acepto completamente. Me amo incondicionalmente. Merezco ser feliz. Merezco el éxito. Merezco relaciones sanas y amorosas. Merezco abundancia. Merezco paz.'",
            "Tu valor no depende de tu productividad, de tu apariencia, de tu estatus, de tu cuenta bancaria, ni de lo que otros piensen de ti. Tu valor es intrínseco, es inherente, es innegociable. Naciste valioso y morirás valioso. Nada puede cambiar eso.",
            "Piensa en tres cualidades que admiras en ti mismo. Puede ser tu sentido del humor, tu lealtad, tu creatividad, tu resiliencia, tu capacidad de escuchar... Tómate un momento para reconocer estas cualidades y agradecer por tenerlas.",
            "Cada célula de tu cuerpo está programada para el bienestar y la autorrealización. Tu cuerpo es el vehículo de un alma única e irrepetible en toda la historia del universo. No hay nadie como tú, ni lo hubo, ni lo habrá. Eres una obra maestra irrepetible.",
            "Imagina que tu niño interior está sentado frente a ti. Míralo a los ojos y dile: 'Eres amado. Eres seguro. Eres suficiente. Siempre lo fuiste y siempre lo serás. Yo me encargo de protegerte ahora.' Abraza a ese niño y siente cómo te fundes con él en un solo ser completo.",
            "Y ahora, trayendo contigo todo este amor propio, comienza a regresar lentamente. El amor que sientes por ti mismo es real y permanente. Vivirás desde este lugar de amor de ahora en adelante. Porque eres suficiente. Siempre lo fuiste. Siempre lo serás."
        ].join('\n'),

        ['dejar-fumar']: [
            "Libérate del tabaco... Cierra los ojos y respira profundamente. Siente el aire puro entrando en tus pulmones, llenándolos completamente. Así se siente la verdadera libertad. Tus pulmones están diseñados para recibir aire limpio, oxígeno puro, vida.",
            "Vamos a reprogramar tu mente hoy. Tu subconsciente ha sido programado para asociar el cigarro con placer, con relajación, con un momento de pausa. Pero hoy vamos a revelar la verdad: el cigarro no te da nada. Solo te quita.",
            "Cada cigarro te quita minutos de vida. Te quita dinero que podrías invertir en experiencias maravillosas. Te quita capacidad pulmonar. Te quita el sentido del olfato y del gusto. Te quita energía. Y lo más importante: te quita libertad.",
            "Imagina tu cuerpo dentro de un año sin haber fumado. Tus pulmones están color rosa saludable. Tu piel brilla con luminosidad. Tu cabello está más fuerte. Tu sentido del gusto ha vuelto a disfrutar plenamente de la comida. Tu aliento es fresco todo el día.",
            "Visualízate subiendo escaleras sin agitarte. Corriendo con tus hijos, tus sobrinos o tus mascotas sin cansancio. Despertando por las mañanas sin esa tos molesta. Respirando profundo sin opresión en el pecho. Esa es tu nueva realidad.",
            "Cada vez que sientas el impulso de fumar, vas a recordar esta imagen: tu cuerpo sano, vibrante, libre. Ese impulso dura solo unos segundos. Respira profundo tres veces y el impulso desaparecerá. Tú tienes el control, no la nicotina.",
            "No eres 'alguien que está dejando de fumar'. A partir de este momento, eres un no fumador. Cambia tu identidad. Los no fumadores no fuman. Es así de simple. Tú eres un no fumador. Dilo en tu mente: 'Yo soy un no fumador.'",
            "El tabaco no es tu amigo. Es un negocio multimillonario que literalmente te está matando lentamente. Cada cigarro que compras financia a corporaciones que no se preocupan por tu salud. Hoy cortas esa cadena. Hoy recuperas tu poder.",
            "Vamos a crear una nueva asociación. A partir de ahora, cada vez que pienses en un cigarro, vas a sentir un ligero sabor desagradable en tu boca. Ese sabor es tu cuerpo diciéndote 'gracias por no envenenarme'. Tu cuerpo es tu templo y merece respeto.",
            "El dinero que gastabas en cigarros ahora irá a un fondo especial para algo que realmente quieras. Un viaje, un curso, un regalo especial para ti. Calcula cuánto gastas al mes en cigarros y multiplícalo por doce. Visualiza ese dinero en tus manos, listo para algo maravilloso.",
            "Tu mano ya no necesita sostener un cigarro. Tus manos son instrumentos de creación, de amor, de trabajo significativo. Merecen estar libres. Pueden sostener un libro, una taza de té saludable, la mano de un ser querido. Eso es verdadero placer.",
            "Eres más fuerte que cualquier adicción. Millones de personas han dejado de fumar y ahora viven vidas más plenas. Tú también puedes. De hecho, tú ya lo has decidido. Esta sesión es la confirmación de una decisión que ya tomaste en lo profundo de tu ser.",
            "A partir de hoy, cada respiración profunda que tomes será un recordatorio de tu libertad conquistada. Eres libre. Eres sano. Eres un no fumador. Y así será para siempre."
        ].join('\n'),

        peso: [
            "Tu cuerpo ideal... Cierra tus ojos y respira profundamente, conectando con la sabiduría infinita que reside en tu interior. Tu cuerpo es inteligente, increíblemente inteligente, y sabe exactamente cómo alcanzar su peso ideal y mantenerlo.",
            "Vamos a activar tu metabolismo desde el nivel más profundo de tu mente subconsciente. Tu metabolismo es como un fuego sagrado dentro de ti. Imagina ese fuego en tu abdomen, una llama dorada y cálida que quema eficientemente todo lo que consumes.",
            "Cada vez que comes, esa llama dorada recibe el alimento con gratitud y lo transforma en energía pura, en vitalidad, en fuerza. Nada se almacena como exceso. Todo se convierte en combustible para tu mejor versión.",
            "Visualízate con tu peso ideal. Obsérvate de pie frente a un espejo, viendo la silueta que deseas, la ropa que te queda perfecta, la postura erguida y confiada. Sientes ligereza al caminar, energía al despertar, y una profunda satisfacción con tu reflejo.",
            "Desde este momento, tu relación con la comida cambia radicalmente. La comida ya no es un escape emocional, no es una recompensa, no es un castigo. La comida es combustible de alta calidad para la máquina perfecta que es tu cuerpo.",
            "Tu estómago te envía señales claras: solo necesitas porciones más pequeñas para sentirte satisfecho. Media porción te llena tanto como una entera te llenaba antes. Tu estómago se ha reprogramado para sentirse pleno con cantidades equilibradas.",
            "Desarrollas un gusto natural por los alimentos que realmente nutren tu cuerpo. Las frutas frescas te saben a postre celestial. Las verduras crujientes son un placer para tu paladar. El agua pura es la bebida más deliciosa que existe.",
            "Los antojos por comida procesada, por azúcar refinada, por excesos, simplemente se desvanecen. Ya no tienen poder sobre ti. Cuando ves esos alimentos, tu mente los registra como lo que son: imitaciones vacías que no nutren tu cuerpo ni tu alma.",
            "Tu rutina de ejercicio se vuelve natural y placentera. Encuentras una actividad física que genuinamente disfrutas: caminar por la naturaleza, bailar, nadar, yoga. Tu cuerpo anhela moverse, porque moverse es celebrar la vida.",
            "Cada día que pasa, te acercas más a tu peso ideal. No es una carrera, es un viaje de amor propio. Cada kilo que liberas es una capa de protección que ya no necesitas. Estás emergiendo como la versión más auténtica y radiante de ti mismo.",
            "Imagina la satisfacción de ponerte esa prenda que tanto te gusta y ver que te queda perfecta. Imagina las miradas de admiración y los cumplidos que recibes. Pero más importante aún: imagina cómo te sientes contigo mismo. Esa sensación de orgullo, de logro, de autoestima.",
            "Tu peso ideal no es un número en una báscula, es un estado de bienestar integral. Es dormir profundamente, despertar con energía, tener claridad mental, sentirte ágil y flexible. Ese es tu derecho de nacimiento, y lo estás reclamando ahora.",
            "Cada mañana al despertar, antes de abrir los ojos, repite: 'Mi cuerpo alcanza y mantiene su peso ideal con facilidad, alegría y salud.' Y así será. Tu mente subconsciente ya ha aceptado esta verdad y está trabajando las 24 horas para manifestarla."
        ].join('\n'),

        focus: [
            "Enfoque total... Cierra tus ojos y lleva tu atención al centro de tu frente, justo entre tus cejas. Ese punto es la sede de tu concentración, el centro de comando de tu mente. Respira profundamente y siente cómo ese punto se activa.",
            "Imagina que tienes frente a ti un interruptor de luz láser. Cuando está apagado, tu mente divaga, se dispersa, salta de pensamiento en pensamiento como un mono inquieto. Pero cuando lo enciendes, un rayo de luz láser de concentración pura se proyecta hacia adelante.",
            "Con tu mano derecha mental, gira ese interruptor a la posición de encendido. Siente el click. El rayo láser de tu atención se enciende. Es de un color azul eléctrico brillante, y todo lo que toca queda iluminado con claridad absoluta.",
            "Tu capacidad de concentración es como un músculo. Hoy lo estamos entrenando. Cada vez que practicas este estado de enfoque, tu músculo de concentración se fortalece. Pronto podrás mantener este estado durante horas sin esfuerzo.",
            "Visualiza ahora tu espacio de trabajo ideal. Está perfectamente ordenado. No hay distracciones. Tu teléfono está en modo 'no molestar'. Solo existe una cosa en tu campo de atención: la tarea más importante que tienes frente a ti.",
            "Sientes un deseo profundo y genuino de completar esa tarea. No por obligación, sino porque sabes que cada paso que das te acerca a tus metas más ambiciosas. El trabajo se vuelve gratificante por sí mismo. Estás en estado de flow.",
            "Tu mente procesa la información con una velocidad y claridad asombrosas. Las ideas fluyen como un río cristalino. Las soluciones a problemas complejos aparecen con facilidad. Tu creatividad está en su punto máximo.",
            "Las distracciones externas simplemente rebotan en tu burbuja de concentración. Ruidos, notificaciones, interrupciones... las registras pero no te afectan. Vuelves inmediatamente a tu foco, como si tuvieras un imán mental que te atrae de vuelta al centro.",
            "Internamente también reina el silencio y el orden. Los pensamientos irrelevantes son reconocidos y gentilmente apartados. 'Gracias por venir, pero ahora no', les dices mentalmente, y sigues con tu concentración intacta.",
            "La procrastinación ya no existe en tu vocabulario. Cuando ves una tarea pendiente, tu mente automáticamente la divide en pasos pequeños y accionables. Y el primer paso es tan sencillo que no hay resistencia en hacerlo. Tomas acción inmediata.",
            "Imagínate al final de tu jornada de trabajo habiendo completado todo lo que te propusiste. Sientes una satisfacción profunda. Tu lista de tareas está tachada. Puedes descansar con la conciencia tranquila porque fuiste productivo y eficiente.",
            "Este estado de súper concentración está disponible para ti en cualquier momento. Solo necesitas respirar profundamente tres veces y girar mentalmente tu interruptor láser. Tu cerebro ya aprendió este camino neuronal y lo recorrerá cada vez más fácilmente.",
            "Ahora, trayendo contigo toda esta capacidad de enfoque, regresa lentamente. Estás listo para enfrentar tu día con concentración láser, claridad mental y productividad imparable. Eres imparable. Eres enfoque."
        ].join('\n')
    };

    // ================================================================
    // PRESET CONFIGURATIONS
    // ================================================================

    /** @type {Object<string, import('./types').PresetConfig>} */
    const PRESETS = {
        insomnio: {
            id: 'insomnio',
            label: 'Dormir Profundamente',
            icon: '🌙',
            description: 'Relajación progresiva para un sueño reparador',
            color: 'indigo',
            duration: 1200, // 20 min
            binauralType: 'delta',
            ambientType: 'night',
            scriptKey: 'insomnio',
            tags: ['sueño', 'relajación', 'noche']
        },
        ansiedad: {
            id: 'ansiedad',
            label: 'Liberar Ansiedad',
            icon: '🕊️',
            description: 'Respiración guiada y visualización de seguridad',
            color: 'sky',
            duration: 900, // 15 min
            binauralType: 'theta',
            ambientType: 'ocean',
            scriptKey: 'ansiedad',
            tags: ['calma', 'respiración', 'paz']
        },
        migraña: {
            id: 'migraña',
            label: 'Aliviar Migraña',
            icon: '💆',
            description: 'Luz sanadora y liberación de tensión craneal',
            color: 'violet',
            duration: 900,
            binauralType: 'alpha',
            ambientType: 'rain',
            scriptKey: 'migraña',
            tags: ['dolor', 'alivio', 'sanación']
        },
        autoestima: {
            id: 'autoestima',
            label: 'Amor Propio',
            icon: '💖',
            description: 'Afirmaciones y reconexión con tu valor interior',
            color: 'rose',
            duration: 900,
            binauralType: 'alpha',
            ambientType: 'forest',
            scriptKey: 'autoestima',
            tags: ['amor', 'confianza', 'valor']
        },
        ['dejar-fumar']: {
            id: 'dejar-fumar',
            label: 'Dejar de Fumar',
            icon: '🚭',
            description: 'Reprogramación subconsciente para liberarte del tabaco',
            color: 'emerald',
            duration: 1200,
            binauralType: 'theta',
            ambientType: 'forest',
            scriptKey: 'dejar-fumar',
            tags: ['salud', 'libertad', 'hábitos']
        },
        peso: {
            id: 'peso',
            label: 'Peso Ideal',
            icon: '⚖️',
            description: 'Activa tu metabolismo y hábitos saludables',
            color: 'amber',
            duration: 900,
            binauralType: 'alpha',
            ambientType: 'ocean',
            scriptKey: 'peso',
            tags: ['salud', 'hábitos', 'motivación']
        },
        focus: {
            id: 'focus',
            label: 'Enfoque Total',
            icon: '🎯',
            description: 'Concentración láser y productividad imparable',
            color: 'cyan',
            duration: 600, // 10 min
            binauralType: 'beta',
            ambientType: 'rain',
            scriptKey: 'focus',
            tags: ['productividad', 'concentración', 'trabajo']
        }
    };

    // ================================================================
    // APP STATE
    // ================================================================

    /** @type {string} */
    let currentView = 'home';

    /** @type {string|null} */
    let activePresetId = null;

    /** @type {import('./types').PresetConfig|null} */
    let activePreset = null;

    /** @type {number|null} */
    let activeSessionId = null;

    /** @type {boolean} */
    let appReady = false;

    /** @type {boolean} */
    let isDarkTheme = true;

    /** @type {HTMLElement|null} */
    let appRoot = null;

    // ================================================================
    // PRIVATE: EVENT SYSTEM
    // ================================================================

    /** @type {Object<string, Array<function(...*): void>>} */
    const _listeners = {};

    /**
     * Subscribe to an app event.
     * @param {string} event - Event name
     * @param {function(...*): void} fn - Callback
     */
    function on(event, fn) {
        (_listeners[event] = _listeners[event] || []).push(fn);
    }

    /**
     * Unsubscribe from an app event.
     * @param {string} event
     * @param {function(...*): void} fn
     */
    function off(event, fn) {
        const arr = _listeners[event];
        if (arr) {
            const idx = arr.indexOf(fn);
            if (idx !== -1) arr.splice(idx, 1);
        }
    }

    /**
     * Emit an app event.
     * @param {string} event
     * @param {...*} args
     */
    function emit(event, ...args) {
        const arr = _listeners[event];
        if (arr) {
            for (const fn of [...arr]) {
                try { fn(...args); } catch (e) { console.error(`[NC-APP] Error in event "${event}":`, e); }
            }
        }
    }

    // ================================================================
    // PRIVATE: THEME MANAGEMENT
    // ================================================================

    /**
     * Apply the current theme to the DOM.
     * @param {boolean} dark - True for dark theme, false for light
     */
    function applyTheme(dark) {
        isDarkTheme = dark;
        document.documentElement.classList.toggle('pf-dark', dark);
        document.documentElement.classList.toggle('pf-light', !dark);
        document.documentElement.dataset.theme = dark ? 'dark' : 'light';

        // Update meta theme-color
        const metaTheme = document.querySelector('meta[name="theme-color"]');
        if (metaTheme) {
            metaTheme.setAttribute('content', dark ? '#0f0f1a' : '#f8f9ff');
        }
    }

    /**
     * Toggle between dark and light themes.
     */
    function toggleTheme() {
        const newDark = !isDarkTheme;
        applyTheme(newDark);

        // Persist to data layer
        if (window.ZENMIX?.data) {
            window.ZENMIX.data.updateConfig('theme', newDark ? 'dark' : 'light');
        }
    }

    // ================================================================
    // PRIVATE: NAVIGATION / ROUTING
    // ================================================================

    /**
     * Navigate to a view with View Transitions API when available.
     * @param {string} view - Target view name
     * @param {Object} [params] - Route parameters
     */
    async function navigate(view, params = {}) {
        if (!appRoot) return;

        const transition = document.startViewTransition
            ? async (fn) => {
                const vt = document.startViewTransition(() => {
                    fn();
                    return new Promise(r => requestAnimationFrame(r));
                });
                await vt.finished;
            }
            : (fn) => { fn(); return Promise.resolve(); };

        const oldView = currentView;
        currentView = view;

        await transition(() => {
            renderView(view, params, oldView);
        });

        emit('navigated', { view, params, previous: oldView });
    }

    // ================================================================
    // PRIVATE: VIEW RENDERER
    // ================================================================

    /**
     * Render a view into the app root element.
     * @param {string} view
     * @param {Object} params
     * @param {string} oldView
     */
    function renderView(view, params, oldView) {
        if (!appRoot) return;

        let html = '';
        switch (view) {
            case 'home':      html = renderHome(params);      break;
            case 'session':   html = renderSession(params);   break;
            case 'custom':    html = renderCustom();          break;
            case 'record':    html = renderRecord();          break;
            case 'stats':     html = renderStats();           break;
            default:          html = renderHome(params);      break;
        }

        appRoot.innerHTML = html;
        appRoot.dataset.view = view;

        // Post-render hooks
        requestAnimationFrame(() => {
            switch (view) {
                case 'home':    postRenderHome();     break;
                case 'session': postRenderSession();  break;
                case 'custom':  postRenderCustom();   break;
                case 'record':  postRenderRecord();   break;
                case 'stats':   postRenderStats();    break;
            }
        });
    }

    // ──────────────────────────────────────────────
    // VIEW: HOME
    // ──────────────────────────────────────────────

    function renderHome(params) {
        const presets = Object.values(PRESETS);
        const stats = window.ZENMIX?.data?.getStats() || { total_sessions: 0, total_minutes: 0, streaks: { current: 0 } };

        const presetCards = presets.map(p => `
            <article class="pf-card pf-interactive" data-action="select-preset" data-preset="${p.id}">
                <div class="pf-card-icon pf-bg-${p.color}">${p.icon}</div>
                <div class="pf-card-content">
                    <h3 class="pf-card-title">${p.label}</h3>
                    <p class="pf-card-desc">${p.description}</p>
                    <div class="pf-card-meta">
                        <span class="pf-tag pf-tag-${p.color}">${Math.floor(p.duration / 60)} min</span>
                        <span class="pf-tag pf-tag-outline">${p.binauralType} Hz</span>
                    </div>
                </div>
            </article>
        `).join('');

        return `
        <div class="pf-view pf-view-home">
            <header class="pf-header">
                <div class="pf-header-left">
                    <h1 class="pf-logo">ZENMIX<span class="pf-accent">v4</span></h1>
                </div>
                <div class="pf-header-right">
                    <button class="pf-btn pf-btn-icon" data-action="toggle-theme" aria-label="Cambiar tema">
                        <span class="pf-icon-theme">${isDarkTheme ? '☀️' : '🌙'}</span>
                    </button>
                    <button class="pf-btn pf-btn-icon" data-action="nav-stats" aria-label="Estadísticas">
                        <span>📊</span>
                    </button>
                </div>
            </header>

            <section class="pf-hero">
                <div class="pf-hero-stats">
                    <div class="pf-stat">
                        <span class="pf-stat-value">${stats.total_sessions}</span>
                        <span class="pf-stat-label">Sesiones</span>
                    </div>
                    <div class="pf-stat">
                        <span class="pf-stat-value">${stats.total_minutes}</span>
                        <span class="pf-stat-label">Minutos</span>
                    </div>
                    <div class="pf-stat">
                        <span class="pf-stat-value">🔥 ${stats.streaks?.current || 0}</span>
                        <span class="pf-stat-label">Racha</span>
                    </div>
                </div>
            </section>

            <nav class="pf-nav-tabs">
                <button class="pf-tab pf-tab-active" data-action="tab-home">🧠 Sesiones</button>
                <button class="pf-tab" data-action="nav-custom">🎛️ Personalizar</button>
                <button class="pf-tab" data-action="nav-record">🎤 Grabar</button>
            </nav>

            <section class="pf-presets-grid">
                ${presetCards}
            </section>

            <nav class="pf-bottom-nav">
                <button class="pf-nav-item pf-nav-active" data-action="nav-home">🏠</button>
                <button class="pf-nav-item" data-action="nav-custom">🎛️</button>
                <button class="pf-nav-item" data-action="nav-record">🎤</button>
                <button class="pf-nav-item" data-action="nav-stats">📊</button>
            </nav>
        </div>`;
    }

    function postRenderHome() {
        // Any post-render DOM setup
    }

    // ──────────────────────────────────────────────
    // VIEW: SESSION
    // ──────────────────────────────────────────────

    function renderSession(params) {
        const preset = activePreset || PRESETS.insomnio;
        const mins = Math.floor(preset.duration / 60);

        return `
        <div class="pf-view pf-view-session">
            <header class="pf-session-header pf-bg-${preset.color}">
                <button class="pf-btn pf-btn-icon pf-btn-back" data-action="stop-session">✕</button>
                <div class="pf-session-preset-info">
                    <span class="pf-session-icon">${preset.icon}</span>
                    <h2>${preset.label}</h2>
                    <p>${preset.description}</p>
                </div>
            </header>

            <main class="pf-session-main">
                <div class="pf-timer-container" id="session-timer">
                    <svg class="pf-timer-ring" viewBox="0 0 120 120">
                        <circle class="pf-timer-bg" cx="60" cy="60" r="54"/>
                        <circle class="pf-timer-progress" cx="60" cy="60" r="54"
                                stroke-dasharray="339.292" stroke-dashoffset="0"
                                id="timer-progress-ring"/>
                    </svg>
                    <div class="pf-timer-text">
                        <span class="pf-timer-time" id="timer-display">00:00</span>
                        <span class="pf-timer-label">/${mins}:00</span>
                    </div>
                </div>

                <div class="pf-session-controls">
                    <div class="pf-channel-controls">
                        <div class="pf-channel">
                            <label>🎤 Voz</label>
                            <input type="range" min="0" max="100" value="70"
                                   data-channel="voice" class="pf-slider">
                        </div>
                        <div class="pf-channel">
                            <label>🧠 Binaural</label>
                            <input type="range" min="0" max="100" value="50"
                                   data-channel="binaural" class="pf-slider">
                        </div>
                        <div class="pf-channel">
                            <label>🌿 Ambiente</label>
                            <input type="range" min="0" max="100" value="40"
                                   data-channel="ambient" class="pf-slider">
                        </div>
                    </div>

                    <button class="pf-btn pf-btn-danger pf-btn-lg" data-action="stop-session">
                        ⏹️ Detener Sesión
                    </button>
                </div>
            </main>
        </div>`;
    }

    function postRenderSession() {
        // Sync slider values from audio engine
        const audio = window.ZENMIX?.audio;
        if (audio) {
            ['voice', 'binaural', 'ambient'].forEach(ch => {
                const slider = document.querySelector(`[data-channel="${ch}"]`);
                if (slider) {
                    slider.value = Math.round(audio.getChannelVolume(ch) * 100);
                }
            });
        }
    }

    // ──────────────────────────────────────────────
    // VIEW: CUSTOM
    // ──────────────────────────────────────────────

    function renderCustom() {
        const binauralTypes = window.ZENMIX?.audio?.getBinauralTypes() || [];
        const ambientTypes = window.ZENMIX?.audio?.getAmbientTypes() || [];

        return `
        <div class="pf-view pf-view-custom">
            <header class="pf-header">
                <button class="pf-btn pf-btn-icon" data-action="nav-home">←</button>
                <h2>Personalizar Sesión</h2>
            </header>

            <main class="pf-custom-form">
                <div class="pf-form-group">
                    <label>🧠 Ondas Binaurales</label>
                    <div class="pf-select-group" id="binaural-select">
                        ${binauralTypes.map(b => `
                            <button class="pf-option ${b.key === 'alpha' ? 'pf-option-active' : ''}"
                                    data-action="select-binaural" data-value="${b.key}">
                                <strong>${b.label}</strong>
                                <small>${b.range}</small>
                            </button>
                        `).join('')}
                    </div>
                </div>

                <div class="pf-form-group">
                    <label>🌿 Sonido Ambiente</label>
                    <div class="pf-select-group" id="ambient-select">
                        ${ambientTypes.map(a => `
                            <button class="pf-option ${a.key === 'rain' ? 'pf-option-active' : ''}"
                                    data-action="select-ambient" data-value="${a.key}">
                                <strong>${a.icon} ${a.label}</strong>
                            </button>
                        `).join('')}
                    </div>
                </div>

                <div class="pf-form-group">
                    <label>⏱️ Duración</label>
                    <div class="pf-duration-picker">
                        ${[5, 10, 15, 20, 30, 45, 60].map(m => `
                            <button class="pf-option ${m === 10 ? 'pf-option-active' : ''}"
                                    data-action="select-duration" data-value="${m}">
                                ${m} min
                            </button>
                        `).join('')}
                    </div>
                </div>

                <div class="pf-form-group">
                    <label>🗣️ Voz Guiada</label>
                    <label class="pf-toggle">
                        <input type="checkbox" checked id="voice-toggle">
                        <span class="pf-toggle-slider"></span>
                        Activar narración por voz
                    </label>
                </div>

                <button class="pf-btn pf-btn-primary pf-btn-lg pf-btn-full"
                        data-action="start-custom-session">
                    ▶️ Iniciar Sesión Personalizada
                </button>
            </main>
        </div>`;
    }

    function postRenderCustom() {
        // Preview binaural on selection hover? Could add here
    }

    // ──────────────────────────────────────────────
    // VIEW: RECORD
    // ──────────────────────────────────────────────

    function renderRecord() {
        const isRecording = window.ZENMIX?.audio?.isActive() || false;
        const hasRecording = false; // Could track via module state

        return `
        <div class="pf-view pf-view-record">
            <header class="pf-header">
                <button class="pf-btn pf-btn-icon" data-action="nav-home">←</button>
                <h2>Grabadora de Voz</h2>
            </header>

            <main class="pf-record-main">
                <div class="pf-record-visualizer" id="record-visualizer">
                    <div class="pf-record-ring ${isRecording ? 'pf-recording' : ''}">
                        <span class="pf-record-icon">${isRecording ? '🔴' : '🎤'}</span>
                    </div>
                    <p class="pf-record-status">${isRecording ? 'Grabando...' : 'Listo para grabar'}</p>
                </div>

                <div class="pf-record-controls">
                    <button class="pf-btn pf-btn-primary pf-btn-lg"
                            data-action="toggle-recording">
                        ${isRecording ? '⏹️ Detener' : '🔴 Grabar'}
                    </button>

                    <div class="pf-record-options">
                        <label class="pf-checkbox">
                            <input type="checkbox" data-effect="echo">
                            Eco
                        </label>
                        <label class="pf-checkbox">
                            <input type="checkbox" data-effect="reverb">
                            Reverb
                        </label>
                    </div>
                </div>

                <div class="pf-recordings-list" id="recordings-list">
                    <p class="pf-empty-state">No hay grabaciones todavía</p>
                </div>
            </main>
        </div>`;
    }

    function postRenderRecord() {
        // Setup visualizer if needed
    }

    // ──────────────────────────────────────────────
    // VIEW: STATS
    // ──────────────────────────────────────────────

    function renderStats() {
        const stats = window.ZENMIX?.data?.getStats() || {
            total_sessions: 0, total_minutes: 0, favorite_preset: null,
            streaks: { current: 0, best: 0 }, first_session_date: null,
            presets_used: {}
        };

        const topPresets = Object.entries(stats.presets_used || {})
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        return `
        <div class="pf-view pf-view-stats">
            <header class="pf-header">
                <button class="pf-btn pf-btn-icon" data-action="nav-home">←</button>
                <h2>Estadísticas</h2>
                <button class="pf-btn pf-btn-icon" data-action="export-data">📤</button>
            </header>

            <main class="pf-stats-main">
                <div class="pf-stats-grid">
                    <div class="pf-stat-card pf-bg-indigo">
                        <span class="pf-stat-big">${stats.total_sessions}</span>
                        <span>Sesiones Totales</span>
                    </div>
                    <div class="pf-stat-card pf-bg-emerald">
                        <span class="pf-stat-big">${stats.total_minutes}</span>
                        <span>Minutos Totales</span>
                    </div>
                    <div class="pf-stat-card pf-bg-amber">
                        <span class="pf-stat-big">🔥 ${stats.streaks?.current || 0}</span>
                        <span>Racha Actual</span>
                    </div>
                    <div class="pf-stat-card pf-bg-rose">
                        <span class="pf-stat-big">🏆 ${stats.streaks?.best || 0}</span>
                        <span>Mejor Racha</span>
                    </div>
                </div>

                <div class="pf-stats-section">
                    <h3>⭐ Sesión Favorita</h3>
                    <p>${stats.favorite_preset ? PRESETS[stats.favorite_preset]?.label || stats.favorite_preset : '—'}</p>
                </div>

                <div class="pf-stats-section">
                    <h3>📅 Primera Sesión</h3>
                    <p>${stats.first_session_date ? new Date(stats.first_session_date).toLocaleDateString('es-MX', { dateStyle: 'long' }) : '—'}</p>
                </div>

                <div class="pf-stats-section">
                    <h3>📊 Presets Más Usados</h3>
                    <div class="pf-stats-bars">
                        ${topPresets.map(([key, count]) => {
                            const preset = PRESETS[key];
                            const pct = stats.total_sessions > 0 ? (count / stats.total_sessions * 100) : 0;
                            return `
                            <div class="pf-stat-bar">
                                <span class="pf-bar-label">${preset?.icon || '🎯'} ${preset?.label || key}</span>
                                <div class="pf-bar-track">
                                    <div class="pf-bar-fill" style="width:${pct}%"></div>
                                </div>
                                <span class="pf-bar-value">${count}</span>
                            </div>`;
                        }).join('') || '<p class="pf-empty-state">Sin datos aún</p>'}
                    </div>
                </div>

                <div class="pf-stats-actions">
                    <button class="pf-btn pf-btn-outline" data-action="import-data">📥 Importar Datos</button>
                    <button class="pf-btn pf-btn-outline" data-action="wipe-data">🗑️ Borrar Todo</button>
                </div>
            </main>
        </div>`;
    }

    function postRenderStats() {
        // Animate bar charts
        requestAnimationFrame(() => {
            document.querySelectorAll('.pf-bar-fill').forEach(bar => {
                bar.style.transition = 'width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)';
            });
        });
    }

    // ================================================================
    // PRIVATE: EVENT DELEGATION (single listener on app root)
    // ================================================================

    /**
     * Global event delegation handler.
     * Matches [data-action] attributes and routes to handlers.
     * @param {Event} e
     */
    function handleDelegatedEvent(e) {
        const target = /** @type {HTMLElement} */ (e.target);
        const actionEl = target.closest('[data-action]');
        if (!actionEl) return;

        const action = actionEl.dataset.action;
        if (!action) return;

        // Handle channel sliders
        const channelSlider = target.closest('[data-channel]');
        if (channelSlider && target.tagName === 'INPUT' && target.type === 'range') {
            const channel = channelSlider.dataset.channel;
            if (channel && window.ZENMIX?.audio) {
                window.ZENMIX.audio.setChannelVolume(channel, parseInt(target.value) / 100);
            }
            return;
        }

        // Route actions
        switch (action) {
            // Navigation
            case 'nav-home':     navigate('home'); break;
            case 'nav-custom':   navigate('custom'); break;
            case 'nav-record':   navigate('record'); break;
            case 'nav-stats':    navigate('stats'); break;

            // Theme
            case 'toggle-theme': toggleTheme(); setTimeout(() => renderView(currentView, {}), 100); break;

            // Presets
            case 'select-preset':
                selectPreset(actionEl.dataset.preset);
                break;

            // Session
            case 'stop-session':       stopSession(); break;
            case 'start-custom-session': startCustomSession(); break;

            // Custom form
            case 'select-binaural':
                selectOption(actionEl, '#binaural-select .pf-option');
                break;
            case 'select-ambient':
                selectOption(actionEl, '#ambient-select .pf-option');
                break;
            case 'select-duration':
                selectOption(actionEl, '.pf-duration-picker .pf-option');
                break;

            // Recording
            case 'toggle-recording':
                toggleRecording();
                break;

            // Data management
            case 'export-data': exportAppData(); break;
            case 'import-data': importAppData(); break;
            case 'wipe-data':   confirmWipeData(); break;

            // Tabs
            case 'tab-home':
                // Already on home — could scroll to presets
                break;
        }
    }

    // ================================================================
    // PRIVATE: ACTION HANDLERS
    // ================================================================

    /**
     * Select an option in a radio-like group and update visual.
     * @param {HTMLElement} el
     * @param {string} groupSelector
     */
    function selectOption(el, groupSelector) {
        document.querySelectorAll(groupSelector).forEach(o => o.classList.remove('pf-option-active'));
        el.classList.add('pf-option-active');
    }

    /**
     * Select a preset and navigate to session.
     * @param {string} presetId
     */
    async function selectPreset(presetId) {
        const preset = PRESETS[presetId];
        if (!preset) {
            console.warn(`[NC-APP] Unknown preset: "${presetId}"`);
            return;
        }

        activePreset = preset;
        activePresetId = presetId;

        // Start audio session
        const audio = window.ZENMIX?.audio;
        if (audio && EMBEDDED_SCRIPTS[preset.scriptKey]) {
            const result = await audio.startSession({
                duration: preset.duration,
                binauralType: preset.binauralType,
                ambientType: preset.ambientType,
                voiceEnabled: true,
                scriptText: EMBEDDED_SCRIPTS[preset.scriptKey],
                volumes: {
                    voice: 0.7,
                    binaural: 0.5,
                    ambient: 0.4,
                    master: 0.8
                }
            });

            if (result.started) {
                // Create session entry in data layer
                const data = window.ZENMIX?.data;
                if (data) {
                    const session = data.addSession({
                        preset: presetId,
                        duration_seconds: preset.duration,
                        binaural_type: preset.binauralType,
                        ambient_type: preset.ambientType
                    });
                    if (session) activeSessionId = session.id;
                }

                navigate('session');
            } else {
                console.error('[NC-APP] Failed to start session:', result.error);
            }
        }
    }

    /**
     * Stop the active session gracefully.
     */
    function stopSession() {
        const audio = window.ZENMIX?.audio;
        const data = window.ZENMIX?.data;

        if (audio) {
            const result = audio.stopSession();

            if (result.sessionData && data) {
                // Update stats
                data.updateStatsAfterSession({
                    id: activeSessionId || `zs_${Date.now()}`,
                    created_at: new Date().toISOString(),
                    preset: activePresetId || 'custom',
                    duration_seconds: result.sessionData.duration_seconds,
                    completed: result.sessionData.completed,
                    voice_enabled: true,
                    binaural_type: result.sessionData.binauralType,
                    ambient_type: result.sessionData.ambientType,
                    notes: ''
                });
            }
        }

        activeSessionId = null;
        navigate('home');
    }

    /**
     * Start a custom session from the custom form values.
     */
    async function startCustomSession() {
        const audio = window.ZENMIX?.audio;
        if (!audio) return;

        // Read selected values
        const binauralBtn = document.querySelector('#binaural-select .pf-option-active');
        const ambientBtn = document.querySelector('#ambient-select .pf-option-active');
        const durationBtn = document.querySelector('.pf-duration-picker .pf-option-active');
        const voiceToggle = document.querySelector('#voice-toggle');

        const binauralType = binauralBtn?.dataset.value || 'alpha';
        const ambientType = ambientBtn?.dataset.value || 'rain';
        const durationMin = parseInt(durationBtn?.dataset.value || '10');
        const voiceEnabled = voiceToggle?.checked ?? true;

        activePreset = {
            id: 'custom',
            label: 'Sesión Personalizada',
            icon: '🎛️',
            description: `${binauralType} + ${ambientType}, ${durationMin} min`,
            color: 'slate',
            duration: durationMin * 60,
            binauralType,
            ambientType,
            scriptKey: null,
            tags: ['personalizado']
        };

        const result = await audio.startSession({
            duration: durationMin * 60,
            binauralType,
            ambientType,
            voiceEnabled,
            scriptText: voiceEnabled ? generateCustomScript(binauralType) : null
        });

        if (result.started) {
            const data = window.ZENMIX?.data;
            if (data) {
                const session = data.addSession({
                    preset: 'custom',
                    duration_seconds: durationMin * 60,
                    binaural_type: binauralType,
                    ambient_type: ambientType
                });
                if (session) activeSessionId = session.id;
            }
            navigate('session');
        }
    }

    /**
     * Generate a simple custom hypnosis script from the binaural type.
     * @param {string} binauralType
     * @returns {string}
     */
    function generateCustomScript(binauralType) {
        const scripts = {
            delta: "Relájate profundamente... Deja que cada músculo de tu cuerpo se afloje completamente... Flotando en la oscuridad tranquila... Entregándote al sueño reparador...",
            theta: "Entra en un estado de meditación profunda... Tu mente se aquieta como un lago en calma... Los pensamientos se disuelven... Solo existe este momento de paz interior...",
            alpha: "Relájate con suavidad... Siente la calma envolviendo tu cuerpo... Una ola de bienestar recorre cada parte de ti... Estás en armonía perfecta...",
            beta: "Activa tu mente... Siente la energía fluyendo a través de tu cerebro... Claridad, enfoque, determinación... Estás listo para lo que sea...",
            gamma: "Conéctate con la claridad suprema... Tu conciencia se expande... Todo tiene sentido, todo está conectado... Eres pura luz mental..."
        };
        return scripts[binauralType] || scripts.alpha;
    }

    /**
     * Toggle microphone recording.
     */
    async function toggleRecording() {
        const audio = window.ZENMIX?.audio;
        if (!audio) return;

        const recordRing = document.querySelector('.pf-record-ring');
        const isRec = recordRing?.classList.contains('pf-recording');

        if (isRec) {
            const result = await audio.stopRecording();
            if (result.blob) {
                // Save recording reference
                const recordingsList = document.getElementById('recordings-list');
                if (recordingsList) {
                    const entry = document.createElement('div');
                    entry.className = 'pf-recording-entry';
                    entry.innerHTML = `
                        <span>🎙️ Grabación ${new Date().toLocaleTimeString('es-MX')}</span>
                        <audio controls src="${result.url}"></audio>
                    `;
                    recordingsList.appendChild(entry);
                }
            }
            recordRing?.classList.remove('pf-recording');
        } else {
            const result = await audio.recordVoice();
            if (result.started) {
                recordRing?.classList.add('pf-recording');
            }
        }

        // Re-render
        renderView('record', {});
    }

    /**
     * Export all app data as JSON download.
     */
    function exportAppData() {
        const data = window.ZENMIX?.data;
        if (!data) return;

        const exportObj = data.exportData();
        const json = JSON.stringify(exportObj, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `zenmix-backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();

        URL.revokeObjectURL(url);
    }

    /**
     * Trigger file input for JSON import.
     */
    function importAppData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = /** @type {HTMLInputElement} */ (e.target).files?.[0];
            if (!file) return;

            try {
                const text = await file.text();
                const importData = JSON.parse(text);
                const data = window.ZENMIX?.data;
                if (data) {
                    const result = await data.importData(importData);
                    if (result.success) {
                        alert('✅ Datos importados correctamente.');
                    } else {
                        alert('⚠️ Errores: ' + result.errors.join(', '));
                    }
                    renderView('stats', {});
                }
            } catch (err) {
                alert('❌ Archivo inválido: ' + err.message);
            }
        };
        input.click();
    }

    /**
     * Confirm and wipe all data.
     */
    function confirmWipeData() {
        if (confirm('¿Estás seguro? Esto borrará TODAS tus sesiones, estadísticas y configuración de ZENMIX.')) {
            const data = window.ZENMIX?.data;
            if (data) {
                data.wipeAllData();
                renderView('stats', {});
            }
        }
    }

    // ================================================================
    // PRIVATE: AUDIO EVENT HANDLERS (listen to zenmix: events)
    // ================================================================

    function setupAudioEventListeners() {
        document.addEventListener('zenmix:timer', /** @param {CustomEvent} e */ (e) => {
            const { time, remaining } = e.detail;
            updateTimerDisplay(time, remaining);
        });

        document.addEventListener('zenmix:session:started', () => {
            console.info('[NC-APP] Session started event received.');
        });

        document.addEventListener('zenmix:session:stopped', /** @param {CustomEvent} e */ (e) => {
            const result = e.detail;
            if (result) {
                console.info('[NC-APP] Session stopped:', result);
            }
        });
    }

    /**
     * Update the timer display in the session view.
     * @param {string} time - Formatted MM:SS
     * @param {number} remaining - Remaining seconds
     */
    function updateTimerDisplay(time, remaining) {
        const display = document.getElementById('timer-display');
        const ring = document.getElementById('timer-progress-ring');

        if (display) {
            display.textContent = time;
        }

        if (ring && activePreset) {
            const totalSecs = activePreset.duration;
            const progress = 1 - (remaining / totalSecs);
            const circumference = 339.292; // 2 * PI * 54
            ring.style.strokeDashoffset = circumference * (1 - progress);
        }
    }

    // ================================================================
    // PUBLIC: INITIALIZATION
    // ================================================================

    /**
     * Initialize the full application.
     * Registers event delegation, sets up modules, configures theme, and renders.
     * @returns {Promise<{ready: boolean, error?: string}>}
     */
    async function init() {
        if (appReady) return { ready: true };

        console.info('[NC-APP] Initializing ZENMIX App Controller v4...');

        try {
            // 1. Find app root
            appRoot = document.getElementById('zenmix-app');
            if (!appRoot) {
                console.error('[NC-APP] No element with id="zenmix-app" found. Creating one...');
                appRoot = document.createElement('div');
                appRoot.id = 'zenmix-app';
                document.body.appendChild(appRoot);
            }

            // 2. Initialize data layer first
            const data = window.ZENMIX?.data;
            if (data) {
                await data.init();
                console.info('[NC-APP] Data layer ready.');
            } else {
                console.warn('[NC-APP] Data layer not found (nc-data-v4.js must be loaded first). Running without persistence.');
            }

            // 3. Initialize audio engine
            const audio = window.ZENMIX?.audio;
            if (audio) {
                audio.init(); // Fire-and-forget (requires user gesture, but init can happen early)
                console.info('[NC-APP] Audio engine initializing...');
            } else {
                console.warn('[NC-APP] Audio engine not found (nc-audio-v4.js must be loaded before nc-app-v4.js).');
            }

            // 4. Load config and apply theme
            if (data) {
                const config = data.getConfig();
                isDarkTheme = config.theme === 'dark';
            }
            applyTheme(isDarkTheme);

            // 5. Setup event delegation
            appRoot.addEventListener('click', handleDelegatedEvent);
            appRoot.addEventListener('change', handleDelegatedEvent);

            // 6. Listen for audio events
            setupAudioEventListeners();

            // 7. Detect keyboard shortcuts
            document.addEventListener('keydown', /** @param {KeyboardEvent} e */ (e) => {
                if (e.key === 'Escape' && currentView === 'session') {
                    stopSession();
                }
                if (e.key === 't' && e.ctrlKey) {
                    e.preventDefault();
                    toggleTheme();
                    renderView(currentView, {});
                }
            });

            // 8. Handle page visibility (suspend audio when hidden)
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    audio?.suspend();
                } else {
                    audio?.resume();
                }
            });

            // 9. Render initial view
            renderView('home', {});

            appReady = true;
            console.info('[NC-APP] Application ready. Views: home | session | custom | record | stats');

            return { ready: true };
        } catch (e) {
            console.error('[NC-APP] Initialization failed:', e);
            return { ready: false, error: e.message };
        }
    }

    // ================================================================
    // PUBLIC API EXPOSED ON MODULE
    // ================================================================

    const MODULE = {
        // Lifecycle
        init,

        // Navigation
        navigate,
        get currentView() { return currentView; },

        // Theme
        toggleTheme,
        get isDarkTheme() { return isDarkTheme; },

        // Data
        getPresets: () => PRESETS,
        getScript: (key) => EMBEDDED_SCRIPTS[key] || null,

        // Events
        on,
        off,

        // Status
        get ready() { return appReady; }
    };

    // ================================================================
    // NAMESPACE REGISTRATION
    // ================================================================

    /** @type {import('./types').ZENMIXNamespace} */
    window.ZENMIX = window.ZENMIX || {};
    window.ZENMIX.app = MODULE;

    console.info('[NC-APP] Registered at window.ZENMIX.app');

    // Auto-init when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => MODULE.init());
    } else {
        MODULE.init();
    }
})();
