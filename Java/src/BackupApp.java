import javax.swing.*;
import javax.swing.border.TitledBorder;
import javax.swing.table.DefaultTableModel;
import java.awt.*;
import java.nio.file.Files;
import java.nio.file.InvalidPathException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

public class BackupApp extends JFrame {

    private static final Pattern NOME_BANCO = Pattern.compile("^[A-Za-z0-9_]{1,63}$");
    private static final Pattern HOST = Pattern.compile("^[A-Za-z0-9.\\-]{1,253}$");

    // Conexão
    private final JTextField txtHost = new JTextField("localhost", 15);
    private final JTextField txtPorta = new JTextField("5432", 6);
    private final JTextField txtBanco = new JTextField(15);
    private final JTextField txtUsuario = new JTextField("postgres", 15);
    private final JPasswordField txtSenha = new JPasswordField(15);

    // Parâmetros do backup
    private final JTextField txtDestino = new JTextField(28);
    private final JSpinner spQuantidade = new JSpinner(new SpinnerNumberModel(0, 0, 1000, 1));
    private final JTextField txtCopia = new JTextField(28);
    private final JCheckBox chkManutencao = new JCheckBox("Executar manutenção");
    private final JCheckBox chkManutencaoCompleta = new JCheckBox("Manutenção completa (com análise)");
    private final JCheckBox chkCriptografar = new JCheckBox("Criptografar (AES)");
    private final JPasswordField txtChave = new JPasswordField(15);
    private final JCheckBox chkCompactar = new JCheckBox("Compactar (ZIP com senha)");
    private final JPasswordField txtSenhaZip = new JPasswordField(15);

    // Saída
    private final JTextArea txtLog = new JTextArea(8, 60);
    private final DefaultTableModel modeloTabelas =
            new DefaultTableModel(new String[]{"Tabela", "Registros"}, 0) {
                @Override
                public boolean isCellEditable(int row, int column) {
                    return false;
                }
            };
    private final JButton btnTestar = new JButton("Testar conexão");
    private final JButton btnValidar = new JButton("Validar parâmetros");
    private final JLabel lblStatus = new JLabel("Sem conexão testada.");

    public BackupApp() {
        super("Plataforma de Gerenciamento de Backup");
        setDefaultCloseOperation(EXIT_ON_CLOSE);
        setLayout(new BorderLayout(8, 8));

        JTabbedPane abas = new JTabbedPane();
        abas.addTab("Configuração", montarAbaConfiguracao());
        abas.addTab("Tabelas do banco", montarAbaTabelas());
        add(abas, BorderLayout.CENTER);

        txtLog.setEditable(false);
        txtLog.setFont(new Font(Font.MONOSPACED, Font.PLAIN, 12));
        JScrollPane scrollLog = new JScrollPane(txtLog);
        scrollLog.setBorder(BorderFactory.createTitledBorder("Mensagens"));

        JPanel rodape = new JPanel(new BorderLayout());
        rodape.add(scrollLog, BorderLayout.CENTER);
        rodape.add(lblStatus, BorderLayout.SOUTH);
        lblStatus.setBorder(BorderFactory.createEmptyBorder(2, 8, 4, 8));
        add(rodape, BorderLayout.SOUTH);

        configurarEventos();
        atualizarEstadoCampos();

        pack();
        setMinimumSize(getSize());
        setLocationRelativeTo(null);
    }

    // ---------------------------------------------------------------- UI

    private JPanel montarAbaConfiguracao() {
        JPanel painel = new JPanel(new GridBagLayout());
        GridBagConstraints g = new GridBagConstraints();
        g.insets = new Insets(4, 4, 4, 4);
        g.fill = GridBagConstraints.HORIZONTAL;
        g.gridx = 0;
        g.weightx = 1;

        // --- Conexão
        JPanel pConexao = new JPanel(new GridBagLayout());
        pConexao.setBorder(BorderFactory.createTitledBorder(
                BorderFactory.createEtchedBorder(), "Conexão com o banco de dados",
                TitledBorder.LEFT, TitledBorder.TOP));
        adicionarLinha(pConexao, 0, "Servidor:", txtHost, "Porta:", txtPorta);
        adicionarLinha(pConexao, 1, "Banco de dados:", txtBanco, "Usuário:", txtUsuario);
        adicionarLinha(pConexao, 2, "Senha:", txtSenha, null, null);
        g.gridy = 0;
        painel.add(pConexao, g);

        // --- Parâmetros
        JPanel pBackup = new JPanel(new GridBagLayout());
        pBackup.setBorder(BorderFactory.createTitledBorder(
                BorderFactory.createEtchedBorder(), "Parâmetros do backup",
                TitledBorder.LEFT, TitledBorder.TOP));

        GridBagConstraints c = new GridBagConstraints();
        c.insets = new Insets(4, 4, 4, 4);
        c.fill = GridBagConstraints.HORIZONTAL;

        // Caminho de destino
        c.gridy = 0; c.gridx = 0; c.weightx = 0;
        pBackup.add(new JLabel("Caminho de destino *:"), c);
        c.gridx = 1; c.weightx = 1;
        pBackup.add(txtDestino, c);
        c.gridx = 2; c.weightx = 0;
        pBackup.add(botaoPasta(txtDestino), c);

        // Quantidade a manter
        c.gridy = 1; c.gridx = 0;
        pBackup.add(new JLabel("Quantidade a manter:"), c);
        c.gridx = 1;
        JPanel pQtd = new JPanel(new FlowLayout(FlowLayout.LEFT, 0, 0));
        pQtd.add(spQuantidade);
        pQtd.add(new JLabel("   (0 = sem limite)"));
        pBackup.add(pQtd, c);

        // Cópia adicional
        c.gridy = 2; c.gridx = 0;
        pBackup.add(new JLabel("Cópia adicional:"), c);
        c.gridx = 1; c.weightx = 1;
        pBackup.add(txtCopia, c);
        c.gridx = 2; c.weightx = 0;
        pBackup.add(botaoPasta(txtCopia), c);

        // Manutenção
        c.gridy = 3; c.gridx = 0; c.gridwidth = 3;
        pBackup.add(chkManutencao, c);
        c.gridy = 4;
        chkManutencaoCompleta.setBorder(BorderFactory.createEmptyBorder(0, 24, 0, 0));
        pBackup.add(chkManutencaoCompleta, c);

        // Criptografia
        c.gridy = 5; c.gridwidth = 1; c.gridx = 0;
        pBackup.add(chkCriptografar, c);
        c.gridx = 1;
        JPanel pChave = new JPanel(new FlowLayout(FlowLayout.LEFT, 0, 0));
        pChave.add(new JLabel("Chave:  "));
        pChave.add(txtChave);
        pBackup.add(pChave, c);

        // Compactação
        c.gridy = 6; c.gridx = 0;
        pBackup.add(chkCompactar, c);
        c.gridx = 1;
        JPanel pZip = new JPanel(new FlowLayout(FlowLayout.LEFT, 0, 0));
        pZip.add(new JLabel("Senha do ZIP:  "));
        pZip.add(txtSenhaZip);
        pBackup.add(pZip, c);

        g.gridy = 1;
        painel.add(pBackup, g);

        // --- Botões
        JPanel pBotoes = new JPanel(new FlowLayout(FlowLayout.RIGHT));
        pBotoes.add(btnTestar);
        pBotoes.add(btnValidar);
        g.gridy = 2;
        painel.add(pBotoes, g);

        return painel;
    }

    private JPanel montarAbaTabelas() {
        JTable tabela = new JTable(modeloTabelas);
        tabela.setFillsViewportHeight(true);
        JPanel p = new JPanel(new BorderLayout());
        p.add(new JLabel("  Tabelas encontradas após um teste de conexão bem-sucedido:"), BorderLayout.NORTH);
        p.add(new JScrollPane(tabela), BorderLayout.CENTER);
        p.setPreferredSize(new Dimension(640, 300));
        return p;
    }

    private void adicionarLinha(JPanel p, int linha, String rot1, JComponent comp1,
                                String rot2, JComponent comp2) {
        GridBagConstraints c = new GridBagConstraints();
        c.insets = new Insets(4, 4, 4, 4);
        c.fill = GridBagConstraints.HORIZONTAL;
        c.gridy = linha;
        c.gridx = 0; c.weightx = 0;
        p.add(new JLabel(rot1), c);
        c.gridx = 1; c.weightx = 1;
        p.add(comp1, c);
        if (rot2 != null) {
            c.gridx = 2; c.weightx = 0;
            p.add(new JLabel(rot2), c);
            c.gridx = 3; c.weightx = 0.3;
            p.add(comp2, c);
        }
    }

    private JButton botaoPasta(JTextField destino) {
        JButton b = new JButton("Procurar...");
        b.addActionListener(e -> {
            JFileChooser fc = new JFileChooser();
            fc.setFileSelectionMode(JFileChooser.DIRECTORIES_ONLY);
            if (fc.showOpenDialog(this) == JFileChooser.APPROVE_OPTION) {
                destino.setText(fc.getSelectedFile().getAbsolutePath());
            }
        });
        return b;
    }

    private void configurarEventos() {
        chkManutencao.addActionListener(e -> atualizarEstadoCampos());
        chkCriptografar.addActionListener(e -> atualizarEstadoCampos());
        chkCompactar.addActionListener(e -> atualizarEstadoCampos());
        btnTestar.addActionListener(e -> testarConexao());
        btnValidar.addActionListener(e -> validarParametros());
    }

    private void atualizarEstadoCampos() {
        chkManutencaoCompleta.setEnabled(chkManutencao.isSelected());
        if (!chkManutencao.isSelected()) {
            chkManutencaoCompleta.setSelected(false);
        }
        txtChave.setEnabled(chkCriptografar.isSelected());
        txtSenhaZip.setEnabled(chkCompactar.isSelected());
    }

    // ------------------------------------------------------- Validações

    private List<String> validarConexao() {
        List<String> erros = new ArrayList<>();
        String host = txtHost.getText().trim();
        String banco = txtBanco.getText().trim();

        if (!HOST.matcher(host).matches()) {
            erros.add("Servidor inválido (use apenas letras, números, '.' e '-').");
        }
        try {
            int porta = Integer.parseInt(txtPorta.getText().trim());
            if (porta < 1 || porta > 65535) {
                erros.add("Porta deve estar entre 1 e 65535.");
            }
        } catch (NumberFormatException ex) {
            erros.add("Porta deve ser um número.");
        }
        if (!NOME_BANCO.matcher(banco).matches()) {
            erros.add("Nome do banco inválido (use letras, números e '_').");
        }
        if (txtUsuario.getText().trim().isEmpty()) {
            erros.add("Informe o usuário do banco.");
        }
        return erros;
    }

    private List<String> validarBackup() {
        List<String> erros = new ArrayList<>();

        String erroDestino = validarDiretorio(txtDestino.getText().trim(), "Caminho de destino", true);
        if (erroDestino != null) erros.add(erroDestino);

        String copia = txtCopia.getText().trim();
        if (!copia.isEmpty()) {
            String erroCopia = validarDiretorio(copia, "Cópia adicional", false);
            if (erroCopia != null) erros.add(erroCopia);
        }
        if (chkCriptografar.isSelected() && txtChave.getPassword().length == 0) {
            erros.add("Informe a chave de criptografia.");
        }
        if (chkCompactar.isSelected() && txtSenhaZip.getPassword().length == 0) {
            erros.add("Informe a senha do ZIP.");
        }
        return erros;
    }

    private String validarDiretorio(String texto, String rotulo, boolean obrigatorio) {
        if (texto.isEmpty()) {
            return obrigatorio ? rotulo + " é obrigatório." : null;
        }
        if (texto.indexOf('\0') >= 0) {
            return rotulo + " contém caracteres inválidos.";
        }
        try {
            Path p = Paths.get(texto);
            if (!p.isAbsolute()) {
                return rotulo + " deve ser um caminho absoluto.";
            }
            for (Path parte : p) {
                if (parte.toString().equals("..")) {
                    return rotulo + " não pode conter '..'.";
                }
            }
            p = p.normalize();
            if (!Files.isDirectory(p)) {
                return rotulo + " não existe ou não é um diretório.";
            }
            if (!Files.isWritable(p)) {
                return rotulo + " não tem permissão de escrita.";
            }
        } catch (InvalidPathException ex) {
            return rotulo + " é um caminho inválido.";
        }
        return null;
    }

    private void validarParametros() {
        List<String> erros = validarConexao();
        erros.addAll(validarBackup());
        if (erros.isEmpty()) {
            log("OK: todos os parâmetros são válidos.");
            lblStatus.setText("Parâmetros válidos.");
            JOptionPane.showMessageDialog(this, "Parâmetros válidos.", "Validação",
                    JOptionPane.INFORMATION_MESSAGE);
        } else {
            mostrarErros(erros);
        }
    }

    private void mostrarErros(List<String> erros) {
        StringBuilder sb = new StringBuilder();
        for (String e : erros) {
            sb.append("• ").append(e).append('\n');
            log("ERRO: " + e);
        }
        lblStatus.setText("Foram encontrados " + erros.size() + " problema(s).");
        JOptionPane.showMessageDialog(this, sb.toString(), "Validação",
                JOptionPane.WARNING_MESSAGE);
    }

    // ------------------------------------------------ Teste de conexão

    private void testarConexao() {
        List<String> erros = validarConexao();
        if (!erros.isEmpty()) {
            mostrarErros(erros);
            return;
        }

        final String url = "jdbc:postgresql://" + txtHost.getText().trim() + ":"
                + txtPorta.getText().trim() + "/" + txtBanco.getText().trim();
        final String usuario = txtUsuario.getText().trim();
        final char[] senha = txtSenha.getPassword();

        btnTestar.setEnabled(false);
        lblStatus.setText("Conectando...");
        log("Testando conexão com " + url + " (usuário: " + usuario + ")...");

        // Executa fora da thread da interface para não travar a tela.
        new SwingWorker<Object[], Void>() {
            @Override
            protected Object[] doInBackground() throws Exception {
                DriverManager.setLoginTimeout(5);
                try (Connection con = DriverManager.getConnection(url, usuario, new String(senha))) {
                    DatabaseMetaData md = con.getMetaData();
                    String versao = md.getDatabaseProductName() + " " + md.getDatabaseProductVersion();

                    List<Object[]> linhas = new ArrayList<>();
                    List<String> nomes = new ArrayList<>();
                    try (Statement st = con.createStatement();
                         ResultSet rs = st.executeQuery(
                                 "SELECT table_name FROM information_schema.tables "
                                         + "WHERE table_schema = 'public' AND table_type = 'BASE TABLE' "
                                         + "ORDER BY table_name")) {
                        while (rs.next()) nomes.add(rs.getString(1));
                    }
                    for (String nome : nomes) {
                        String ident = "\"" + nome.replace("\"", "\"\"") + "\"";
                        try (Statement st = con.createStatement();
                             ResultSet rs = st.executeQuery("SELECT COUNT(*) FROM " + ident)) {
                            rs.next();
                            linhas.add(new Object[]{nome, rs.getLong(1)});
                        }
                    }
                    return new Object[]{versao, linhas};
                }
            }

            @Override
            @SuppressWarnings("unchecked")
            protected void done() {
                java.util.Arrays.fill(senha, '\0');
                btnTestar.setEnabled(true);
                try {
                    Object[] r = get();
                    List<Object[]> linhas = (List<Object[]>) r[1];
                    modeloTabelas.setRowCount(0);
                    for (Object[] l : linhas) modeloTabelas.addRow(l);
                    log("SUCESSO: conectado a " + r[0] + ". Tabelas encontradas: " + linhas.size());
                    lblStatus.setText("Conexão OK.");
                    JOptionPane.showMessageDialog(BackupApp.this, "Conexão realizada com sucesso!\n" + r[0],
                            "Testar conexão", JOptionPane.INFORMATION_MESSAGE);
                } catch (Exception ex) {
                    Throwable causa = ex.getCause() != null ? ex.getCause() : ex;
                    String msg = (causa instanceof SQLException)
                            ? "Falha ao conectar: " + causa.getMessage()
                            : "Erro inesperado: " + causa.getMessage();
                    log("FALHA: " + msg);
                    lblStatus.setText("Falha na conexão.");
                    JOptionPane.showMessageDialog(BackupApp.this, msg, "Testar conexão",
                            JOptionPane.ERROR_MESSAGE);
                }
            }
        }.execute();
    }

    // ------------------------------------------------------------ Log

    private void log(String mensagem) {
        String hora = LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss"));
        txtLog.append("[" + hora + "] " + mensagem + "\n");
        txtLog.setCaretPosition(txtLog.getDocument().getLength());
    }

    // ----------------------------------------------------------- main

    public static void main(String[] args) {
        try {
            UIManager.setLookAndFeel(UIManager.getSystemLookAndFeelClassName());
        } catch (Exception ignored) {
        }
        SwingUtilities.invokeLater(() -> new BackupApp().setVisible(true));
    }
}


