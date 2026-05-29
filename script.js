let usuario = JSON.parse(localStorage.getItem('medcontrol_usuario'));
let historico = JSON.parse(localStorage.getItem('medcontrol_historico')) || [];
let medicamentos = JSON.parse(localStorage.getItem('meus_remedios')) || [
    {
        nome: 'Amoxicilina',
        dose: '1 comprimido',
        atual: 12,
        total: 20,
        freq: 8,
        horarios: '08:00, 16:00, 00:00',
        tomadas: 0
    },
    {
        nome: 'Dipirona',
        dose: '20 gotas',
        atual: 4,
        total: 20,
        freq: 6,
        horarios: '06:00, 12:00, 18:00',
        tomadas: 0
    }
];

function salvarDados() {
    localStorage.setItem('meus_remedios', JSON.stringify(medicamentos));
}

function salvarHistorico() {
    localStorage.setItem('medcontrol_historico', JSON.stringify(historico));
}

function fazerLogin() {
    const nome = document.getElementById('login-nome').value.trim();
    const email = document.getElementById('login-email').value.trim();

    if (!nome || !email) {
        alert('Preencha seu nome e e-mail para entrar.');
        return;
    }

    usuario = {
        nome: nome,
        email: email
    };

    localStorage.setItem('medcontrol_usuario', JSON.stringify(usuario));
    iniciarApp();
}

function iniciarApp() {
    const loginScreen = document.getElementById('login-screen');
    const appScreen = document.getElementById('app-screen');
    const mensagemUsuario = document.getElementById('mensagem-usuario');

    if (!usuario) {
        loginScreen.classList.remove('app-hidden');
        appScreen.classList.add('app-hidden');
        return;
    }

    loginScreen.classList.add('app-hidden');
    appScreen.classList.remove('app-hidden');
    mensagemUsuario.textContent = 'Ola, ' + usuario.nome + '. Controle seus remedios, horarios e estoque em um so lugar.';
    renderizar();
    renderizarHistorico();
}

function mudarAba(id) {
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });

    document.getElementById(id).classList.add('active');

    document.querySelectorAll('nav span').forEach(navItem => {
        navItem.classList.remove('nav-active');
    });

    document.getElementById('nav-' + id.split('-')[1]).classList.add('nav-active');

    if (id === 'aba-progresso') {
        renderizarStatus();
    }

    if (id === 'aba-historico') {
        renderizarHistorico();
    }
}

function renderizar() {
    const lista = document.getElementById('lista-remedios');

    lista.innerHTML = '';

    if (medicamentos.length === 0) {
        lista.innerHTML = '<div class="card">Nenhum medicamento cadastrado ainda.</div>';
        renderizarStatus();
        return;
    }

    medicamentos.forEach((remedio, index) => {
        const isCritico = remedio.atual <= 5;
        const porcentagem = Math.max(0, Math.min(100, (remedio.atual / remedio.total) * 100));

        lista.innerHTML += `
            <div class="card ${isCritico ? 'critico' : ''}">
                <div class="card-topo">
                    <strong>${remedio.nome}</strong>
                    <small>${remedio.freq}h/${remedio.freq}h</small>
                </div>

                <div class="card-detalhes">
                    <span><b>Dose:</b> ${remedio.dose || 'Nao informada'}</span>
                    <span><b>Horarios:</b> ${remedio.horarios || 'Nao informado'}</span>
                </div>

                <div class="progress-bg">
                    <div class="progress-fill" style="width: ${porcentagem}%"></div>
                </div>

                <div class="estoque-info">
                    <span>Estoque: <b>${remedio.atual}/${remedio.total}</b></span>

                    <b class="${isCritico ? 'texto-danger' : 'texto-success'}">
                        ${isCritico ? 'REPOR' : 'OK'}
                    </b>
                </div>

                <button class="btn btn-tomar" onclick="tomar(${index})">
                    Confirmar que tomei
                </button>

                <div class="acoes-container">
                    <button class="btn btn-repor" onclick="repor(${index})">
                        Repor Caixa
                    </button>

                    <button class="btn btn-excluir" onclick="excluir(${index})">
                        Excluir
                    </button>
                </div>
            </div>
        `;
    });

    renderizarStatus();
}

function renderizarStatus() {
    const statusContent = document.getElementById('status-content');
    const totalMedicamentos = medicamentos.length;
    const estoqueBaixo = medicamentos.filter(remedio => remedio.atual <= 5).length;
    const dosesTomadas = medicamentos.reduce((total, remedio) => total + (remedio.tomadas || 0), 0);

    statusContent.innerHTML = `
        <div class="card">
            <strong>Medicamentos cadastrados</strong>
            <p class="status-numero">${totalMedicamentos}</p>
            <span>Total de remedios monitorados pelo MEDControl.</span>
        </div>

        <div class="card ${estoqueBaixo > 0 ? 'critico' : ''}">
            <strong>Alertas de estoque</strong>
            <p class="status-numero">${estoqueBaixo}</p>
            <span>${estoqueBaixo > 0 ? 'Ha medicamento precisando de reposicao.' : 'Todos os estoques estao seguros.'}</span>
        </div>

        <div class="card">
            <strong>Doses confirmadas</strong>
            <p class="status-numero">${dosesTomadas}</p>
            <span>Quantidade de vezes que o usuario confirmou o uso.</span>
        </div>
    `;
}

function renderizarHistorico() {
    const historicoContent = document.getElementById('historico-content');

    if (!historicoContent) {
        return;
    }

    if (historico.length === 0) {
        historicoContent.innerHTML = '<div class="card">Nenhuma dose foi registrada ainda.</div>';
        return;
    }

    historicoContent.innerHTML = historico
        .slice()
        .reverse()
        .map(item => `
            <div class="historico-item">
                <div>
                    <strong>${item.nome}</strong>
                    <span>Dose: ${item.dose}</span>
                </div>
                <div class="historico-hora">${item.data} - ${item.hora}</div>
            </div>
        `)
        .join('');
}

function tomar(index) {
    if (medicamentos[index].atual > 0) {
        const agora = new Date();
        const registro = {
            nome: medicamentos[index].nome,
            dose: medicamentos[index].dose || 'Nao informada',
            data: agora.toLocaleDateString('pt-BR'),
            hora: agora.toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit'
            })
        };

        medicamentos[index].atual--;
        medicamentos[index].tomadas = (medicamentos[index].tomadas || 0) + 1;
        historico.push(registro);
        salvarDados();
        salvarHistorico();
        renderizar();
        renderizarHistorico();
    } else {
        alert('Estoque vazio. Reponha o medicamento antes de registrar outra dose.');
    }
}

function repor(index) {
    medicamentos[index].atual = medicamentos[index].total;
    salvarDados();
    renderizar();

    alert('Estoque de ' + medicamentos[index].nome + ' renovado!');
}

function excluir(index) {
    if (confirm('Deseja realmente excluir ' + medicamentos[index].nome + '?')) {
        medicamentos.splice(index, 1);
        salvarDados();
        renderizar();
    }
}

function adicionar() {
    const nome = document.getElementById('nome').value.trim();
    const dose = document.getElementById('dose').value.trim();
    const quantidade = parseInt(document.getElementById('qtd').value);
    const horarios = document.getElementById('horarios').value.trim();
    const frequencia = parseInt(document.getElementById('freq').value);

    if (nome && quantidade > 0) {
        medicamentos.push({
            nome: nome,
            dose: dose || 'Nao informada',
            atual: quantidade,
            total: quantidade,
            horarios: horarios || 'Nao informado',
            freq: frequencia || 8,
            tomadas: 0
        });

        salvarDados();
        renderizar();
        mudarAba('aba-home');

        document.getElementById('nome').value = '';
        document.getElementById('dose').value = '';
        document.getElementById('qtd').value = '';
        document.getElementById('horarios').value = '';
        document.getElementById('freq').value = '';
    } else {
        alert('Preencha pelo menos o nome do medicamento e uma quantidade maior que zero.');
    }
}

iniciarApp();
