const path = require('path')
const webpack = require('webpack')
const autoprefixer = require('autoprefixer');
// Plugins
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

const ENTRY_VTK_EXT = path.join(__dirname, './src/index.js')
const SRC_PATH = path.join(__dirname, './src')
const OUT_PATH = path.join(__dirname, './dist')

module.exports = {
  entry: {
    vtkViewport: ENTRY_VTK_EXT,
  },
  devtool: 'source-map',
  output: {
    path: OUT_PATH,
    filename: '[name].umd.js',
    library: 'ReactVTKjsViewport',
    libraryTarget: 'umd',
    globalObject: 'this',
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: ['babel-loader'],
      },
      {
        test: /\.css$/,
        exclude: /\.module\.css$/,
        use: [
          'style-loader',
          'css-loader',
          {
            loader: 'postcss-loader',
            options: {
              plugins: () => [autoprefixer('last 2 version', 'ie >= 10')],
            },
          },
        ],
      },
    ]
  },
  resolve: {
    modules: [path.resolve(__dirname, 'node_modules'), SRC_PATH],
  },
  externals: [
    // :wave:
    /\b(vtk.js)/,
    // Used to build/load metadata
    {
      'cornerstone-core': {
        commonjs: 'cornerstone-core',
        commonjs2: 'cornerstone-core',
        amd: 'cornerstone-core',
        root: 'cornerstone',
      },
      // Vector 3 use
      'cornerstone-math': {
        commonjs: 'cornerstone-math',
        commonjs2: 'cornerstone-math',
        amd: 'cornerstone-math',
        root: 'cornerstoneMath',
      },
      // 
      react: 'react',
    },
  ],
  plugins: [
    // Uncomment to generate bundle analyzer
    new BundleAnalyzerPlugin(),
    // Show build progress
    new webpack.ProgressPlugin(),
    // Clear dist between builds
    new CleanWebpackPlugin(),
  ],
}
